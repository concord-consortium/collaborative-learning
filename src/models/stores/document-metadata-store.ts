import firebase from "firebase";
import { union } from "lodash";
import { makeAutoObservable, runInAction } from "mobx";
import { SnapshotIn, applySnapshot, typecheck, unprotect } from "@concord-consortium/mobx-state-tree";

import { IDocumentMetadata } from "../../../shared/shared";
import type { DB } from "../../lib/db";
import { typeConverter } from "../../utilities/db-utils";
import { IArrowAnnotation } from "../annotations/arrow-annotation";
import { DocumentMetadataModel, IDocumentMetadataModel } from "../document/document-metadata-model";
import { CurriculumConfigType } from "./curriculum-config";
import { MetadataDocMapModel } from "./sorted-documents";

// The subset of the root stores this store needs. The root `Stores` object satisfies it.
export interface IDocumentMetadataStoreStores {
  db: DB;
  user: { classHash: string };
  curriculumConfig: CurriculumConfigType;
  documents: { exemplarDocuments: any[] };
}

/**
 * Class-scoped cache of the Firestore `documents/<key>` metadata docs.
 *
 * Owns the reactive query over the class's metadata — `watchFirestoreMetaDataDocs` starts
 * the Firestore `onSnapshot` listeners and populates `metadataDocsFiltered` /
 * `metadataDocsWithoutUnit`. `firestoreMetadataDocs` merges those two maps with the
 * exemplar metadata derived from authored documents. Exposes `getMetadata` for
 * synchronous cache reads and `fetchMetadata` for cache-hit-else-point-read.
 * Concurrent point reads for the same key are coalesced.
 */
export class DocumentMetadataStore {
  stores: IDocumentMetadataStoreStores;
  metadataDocsFiltered = MetadataDocMapModel.create();
  metadataDocsWithoutUnit = MetadataDocMapModel.create();
  docsReceived = false;

  private inFlightPointReads = new Map<string, Promise<IDocumentMetadata | undefined>>();

  constructor(stores: IDocumentMetadataStoreStores) {
    makeAutoObservable<DocumentMetadataStore, "inFlightPointReads">(this, { inFlightPointReads: false });
    this.stores = stores;
    // We only want MobX observability + MST serialization, not MST actions, on these maps.
    unprotect(this.metadataDocsFiltered);
    unprotect(this.metadataDocsWithoutUnit);
  }

  getMSTSnapshotFromFBSnapshot(snapshot: firebase.firestore.QuerySnapshot<IDocumentMetadata>) {
    const mstSnapshot: SnapshotIn<typeof MetadataDocMapModel> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      mstSnapshot[data.key] = data;
      try {
        typecheck(DocumentMetadataModel, data);
      } catch (e: any) {
        // We print the full document and error message to help with debugging.
        // The browser console will truncate large error messages so we explicitly
        // print it.
        console.error("DocumentMetadataModel typecheck failed for doc:", {
          error: e.message,
          metadata: data,
        });
        // Skip this invalid document so the rest of the documents can still be processed
        // TODO: It'd be better to return a document with error information rather than skipping it
        // entirely. This way the UI can still show this document with an error message. By doing
        // that users will be more likely to identify something is wrong, and we can track down
        // problems sooner.
        delete mstSnapshot[data.key];
        return;
      }
      const exemplarMetadata = this.exemplarMetadataDocs.get(data.key);
      if (exemplarMetadata) {
        // If this metadata doc in Firestore is an exemplar in the same unit then the exemplar
        // metadata will be found. This will happen when a teacher comments on a exemplar.
        // So in this case we need to merge the strategies from the exemplar with the strategies from
        // the teacher's comments.
        const authoredStrategies = exemplarMetadata.strategies || [];
        const userStrategies = data.strategies || [];
        data.strategies = union(authoredStrategies, userStrategies);
        // We also update the tools incase the author has changed the exemplar content after
        // the teacher commented on the document.
        // We need a copy of the tools so the same array isn't attached to two MST trees at
        // the same time.
        data.tools = [...exemplarMetadata.tools];
      }
    });
    return mstSnapshot;
  }

  watchFirestoreMetaDataDocs (filter: string, unit: string, investigation: number, problem: number) {
    const db = this.stores.db.firestore;
    const converter = typeConverter<IDocumentMetadata>();
    const baseQuery = db.collection("documents")
      .withConverter(converter)
      .where("context_id", "==", this.stores.user.classHash);

    let filteredQuery = baseQuery;

    if (filter !== "All") {
      // an "in" query is used here so that we can find any documents that use unit and
      // any the older renamed unit codes.
      filteredQuery = filteredQuery.where("unit" , "in", this.stores.curriculumConfig.getUnitCodeVariants(unit));
    }
    if (filter === "Investigation" || filter === "Problem") {
      filteredQuery = filteredQuery.where("investigation", "==", String(investigation));
    }
    if (filter === "Problem") {
      filteredQuery = filteredQuery.where("problem", "==", String(problem));
    }

    const disposeFilteredListener = filteredQuery.onSnapshot(snapshot => {
      const mstSnapshot = this.getMSTSnapshotFromFBSnapshot(snapshot);
      runInAction(() => {
        applySnapshot(this.metadataDocsFiltered, mstSnapshot);
        this.docsReceived = true;
      });
    });

    let disposeDocsWithoutUnitListener: () => void | undefined;
    if (filter !== "All") {
      // We need to look for the unit-less documents like personal documents
      const queryForUnitNull = baseQuery.where("unit" , "==", null);
      disposeDocsWithoutUnitListener = queryForUnitNull.onSnapshot(snapshot => {
        const mstSnapshot = this.getMSTSnapshotFromFBSnapshot(snapshot);
        applySnapshot(this.metadataDocsWithoutUnit, mstSnapshot);
      });
    } else {
      // If the filter is "All" then the metaDocsFiltered will include everything.
      this.metadataDocsWithoutUnit.clear();
    }

    // A disposing function that calls the two disposers from the
    // onSnapshot listeners.
    return () => {
      disposeFilteredListener();
      disposeDocsWithoutUnitListener?.();
    };
  }

  get exemplarMetadataDocs() {
    const docsMap = MetadataDocMapModel.create();
    // We are just using this map for consistency with the other maps
    // We don't need the benefits of MST's actions
    unprotect(docsMap);

    // OPTIMIZE: this isn't efficient. Every time a new document is added to stores.documents
    // this exemplarDocuments will be recomputed even though its value will not have changed.
    // So then all of these exemplar docs will get recreated.
    // This list of exemplars shouldn't change once the unit is loaded we should use a different
    // mechanism to find the exemplars rather than stores.documents.
    this.stores.documents.exemplarDocuments.forEach(doc => {
      const exemplarStrategy = doc.properties.get('authoredCommentTag');

      const tools: string[] = [];
      const contentTileTypes: string[] = doc.content?.tileTypes || [];
      const annotationsArray = Array.from<[string, IArrowAnnotation]>(doc.content?.annotations || []);
      const annotationTypes = annotationsArray.map(([key, annotation]) => annotation.type);
      contentTileTypes.forEach(tileType => tools.push(tileType));
      if (annotationTypes.includes("arrowAnnotation")) {
        tools.push("Sparrow");
      }

      const metadata = DocumentMetadataModel.create({
        uid: doc.uid,
        type: doc.type,
        key: doc.key,
        createdAt: doc.createdAt,
        title: doc.title,
        visibility: doc.visibility,
        properties: undefined,
        tools,
        strategies: exemplarStrategy ? [exemplarStrategy] : [],
        investigation: doc.investigation,
        problem: doc.problem,
        unit: doc.unit
      });
      // MST's unprotect doesn't disable MobX's strict mode warnings
      runInAction(() => docsMap.put(metadata));
    });
    return docsMap;
  }

  // What happens if the visibility changes on a metadata document?
  // - FS onSnapshot listener is called
  // - listener applies the snapshot to the map of objects
  // - the keys of the objects don't change in the map
  // - MobX should not re-run this view because it is only reading the key
  //   of each document.
  get firestoreMetadataDocs() {
    const matchedDocKeys = new Set<string>();
    const docsArray: IDocumentMetadataModel[] = [];
    this.metadataDocsFiltered.forEach(doc => {
      docsArray.push(doc);
      matchedDocKeys.add(doc.key);
    });
    this.metadataDocsWithoutUnit.forEach(doc => {
      // If there is a duplicate for some reason just ignore the unit-less one
      if (matchedDocKeys.has(doc.key)) return;
      docsArray.push(doc);
      matchedDocKeys.add(doc.key);
    });
    this.exemplarMetadataDocs.forEach(doc => {
      // If there is a duplicate, it will have been merged with one of the previous
      // maps by the firestore snapshot listeners. So we ignore the duplicate here.
      if (matchedDocKeys.has(doc.key)) return;
      docsArray.push(doc);
      matchedDocKeys.add(doc.key);
    });

    return docsArray;
  }

  /** Synchronous read from the reactive cache only. Returns undefined if not loaded. */
  getMetadata(key: string): IDocumentMetadata | undefined {
    const model = this.metadataDocsFiltered.get(key) ?? this.metadataDocsWithoutUnit.get(key);
    if (!model) return undefined;
    return { ...model, properties: model.propertiesAsStringRecord } as unknown as IDocumentMetadata;
  }

  /** Cache-hit-else-point-read. Concurrent reads for the same key share one query. */
  fetchMetadata(key: string): Promise<IDocumentMetadata | undefined> {
    const cached = this.getMetadata(key);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.inFlightPointReads.get(key);
    if (inFlight) return inFlight;

    const promise = this.pointReadMetadata(key)
      .finally(() => this.inFlightPointReads.delete(key));
    this.inFlightPointReads.set(key, promise);
    return promise;
  }

  private async pointReadMetadata(key: string): Promise<IDocumentMetadata | undefined> {
    const converter = typeConverter<IDocumentMetadata>();
    const query = this.stores.db.firestore.collection("documents")
      .withConverter(converter)
      .where("context_id", "==", this.stores.user.classHash)
      .where("key", "==", key);
    const snapshot = await query.get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data();
  }
}
