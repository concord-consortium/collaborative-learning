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
 * The validated authority for Firestore `documents/<key>` metadata: a shared per-document
 * transform (validate + exemplar-enrich) and validated point reads. Each consumer owns its own
 * filtered watch and routes its snapshots through this transform. Concurrent point reads for
 * the same key are coalesced into a single query.
 */
export class DocumentMetadataStore {
  stores: IDocumentMetadataStoreStores;

  private inFlightPointReads = new Map<string, Promise<IDocumentMetadata>>();

  constructor(stores: IDocumentMetadataStoreStores) {
    makeAutoObservable<DocumentMetadataStore, "inFlightPointReads">(this, { inFlightPointReads: false });
    this.stores = stores;
  }

  /**
   * Validates `data` against DocumentMetadataModel, then applies exemplar enrichment when the
   * key matches an authored exemplar. Returns the validated data, or undefined if it fails
   * validation.
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
   * Validated point read of a single document's metadata, scoped to the user's class. Throws if
   * there is no such document or it fails validation; the error describes the query that was run
   * (collection path, context_id, key) so a developer can understand why it was rejected. A
   * duplicate (context_id, key) match is logged but not fatal — the document is still openable, so
   * the first match is used. Concurrent reads for the same key share one query. Results are not
   * cached here because the Firestore SDK is already caching the documents locally.
   */
  fetchMetadata(key: string): Promise<IDocumentMetadata> {
    const inFlight = this.inFlightPointReads.get(key);
    if (inFlight) return inFlight;

    const promise = this.pointReadMetadata(key)
      .finally(() => this.inFlightPointReads.delete(key));
    this.inFlightPointReads.set(key, promise);
    return promise;
  }

  private async pointReadMetadata(key: string): Promise<IDocumentMetadata> {
    const converter = typeConverter<IDocumentMetadata>();
    const classHash = this.stores.user.classHash;
    // The context_id is required so the security rules know we aren't trying to get
    // documents we don't have access to.
    const documentsCollection = this.stores.db.firestore.collection("documents");
    const query = documentsCollection
      .withConverter(converter)
      .where("context_id", "==", classHash)
      .where("key", "==", key)
      // A (context_id, key) pair should identify exactly one document; limit(2) reads only what we
      // need to open one while still letting us detect (and log) a duplicate below.
      .limit(2);
    const snapshot = await query.get();
    // Describe the query, not a single doc path: the read is a collection query on context_id + key
    // (not a get() at documents/{key}), so this is where we actually looked. The collection path
    // includes the space (e.g. demo/... vs authed/...), which distinguishes demo from production.
    const where = `'${documentsCollection.path}' where context_id == '${classHash}' and key == '${key}'`;
    if (snapshot.empty) {
      throw new Error(`No Firestore metadata document found: queried ${where}`);
    }
    if (snapshot.docs.length > 1) {
      // A data-integrity anomaly, not a reason to deny access: the document is still openable, so
      // log it (console.error surfaces in Rollbar) and proceed with the first match rather than
      // throwing and locking the user out of a document that exists.
      console.error(`Multiple Firestore metadata documents found; using the first: queried ${where}`);
    }
    const metadata = this.metadataFromFirestoreData(snapshot.docs[0].data());
    if (!metadata) {
      throw new Error(`Firestore metadata document failed validation (see logged typecheck error): found by ${where}`);
    }
    return metadata;
  }
}
