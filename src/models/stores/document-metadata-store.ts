import firebase from "firebase";
import { union } from "lodash";
import { makeAutoObservable, runInAction } from "mobx";
import { SnapshotIn, typecheck, unprotect } from "@concord-consortium/mobx-state-tree";

import { IDocumentMetadata } from "../../../shared/shared";
import type { DB } from "../../lib/db";
import { typeConverter } from "../../utilities/db-utils";
import { IArrowAnnotation } from "../annotations/arrow-annotation";
import { DocumentMetadataModel, MetadataDocMapModel } from "../document/document-metadata-model";

// The subset of the root stores this store needs. The root `Stores` object satisfies it.
export interface IDocumentMetadataStoreStores {
  db: DB;
  user: { classHash: string };
  documents: { exemplarDocuments: any[] };
}

/**
 * The authority for Firestore `documents/<key>` metadata.
 *
 * This store does NOT own any filtered watch state. Its value is a single, shared
 * per-document transform (`metadataFromFirestoreData`) that validates and exemplar-enriches
 * any metadata document entering the system, plus validated point reads (`fetchMetadata`).
 * Every path — each consumer's reactive watch (via `getMSTSnapshotFromFBSnapshot`) and every
 * point read — routes through the same transform, so nothing surfaces raw/unvalidated data.
 * Fail fast: an invalid document is treated as absent rather than returned as-is.
 * Concurrent point reads for the same key are coalesced.
 */
export class DocumentMetadataStore {
  stores: IDocumentMetadataStoreStores;

  private inFlightPointReads = new Map<string, Promise<IDocumentMetadata | undefined>>();

  constructor(stores: IDocumentMetadataStoreStores) {
    makeAutoObservable<DocumentMetadataStore, "inFlightPointReads">(this, { inFlightPointReads: false });
    this.stores = stores;
  }

  /**
   * The single per-document gate. Validates `data` against DocumentMetadataModel; on failure
   * logs and returns undefined (the doc is treated as absent). On success, applies exemplar
   * enrichment when the key matches an authored exemplar and returns the validated data.
   */
  metadataFromFirestoreData(data: IDocumentMetadata): IDocumentMetadata | undefined {
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
      // Treat an invalid document as absent so callers never surface raw/possibly-corrupt data.
      // TODO: It'd be better to return a document with error information rather than skipping it
      // entirely. This way the UI can still show this document with an error message. By doing
      // that users will be more likely to identify something is wrong, and we can track down
      // problems sooner.
      return undefined;
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
    return data;
  }

  /**
   * Thin batch wrapper over `metadataFromFirestoreData`, used by consumers' reactive watches.
   * Builds a MetadataDocMapModel snapshot, omitting any doc that fails validation.
   */
  getMSTSnapshotFromFBSnapshot(snapshot: firebase.firestore.QuerySnapshot<IDocumentMetadata>) {
    const mstSnapshot: SnapshotIn<typeof MetadataDocMapModel> = {};
    snapshot.docs.forEach(doc => {
      const validated = this.metadataFromFirestoreData(doc.data());
      if (validated) {
        mstSnapshot[validated.key] = validated;
      }
    });
    return mstSnapshot;
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

  /**
   * Validated point read. Queries `documents where context_id == classHash && key == documentKey`,
   * routes the first result through `metadataFromFirestoreData`, and returns the validated data
   * (or undefined if the query is empty or the doc fails validation). Concurrent reads for the
   * same key share one query. No permanent result cache — the Firestore SDK caches locally.
   */
  fetchMetadata(key: string): Promise<IDocumentMetadata | undefined> {
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
    return this.metadataFromFirestoreData(snapshot.docs[0].data());
  }
}
