import firebase from "firebase";
import { union } from "lodash";
import { makeAutoObservable, runInAction } from "mobx";
import { SnapshotIn, typecheck, unprotect } from "@concord-consortium/mobx-state-tree";

import { escapeKey, IDocumentMetadata } from "../../../shared/shared";
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
   * there is no such document, it fails validation, or its context_id doesn't match the user's
   * class; the error describes the doc path that was read so a developer can understand why it
   * was rejected. Concurrent reads for the same key share one get. Results are not cached here
   * because the Firestore SDK is already caching the documents locally.
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
    // Read the metadata doc directly by id. The doc id is escapeKey(key): every writer (the client
    // createFirestoreMetadataDocument and the createFirestoreMetadataDocument_v2 cloud function)
    // writes there, and the Sep 2025 migration consolidated all prefixed (network_/uid:) docs into
    // this unprefixed doc. A get-by-id is strongly consistent immediately after the awaited write,
    // unlike a query which does not return the result immediately after.
    const documentsCollection = this.stores.db.firestore.collection("documents");
    const docRef = documentsCollection.withConverter(converter).doc(escapeKey(key));
    const snapshot = await docRef.get();
    const where = `'${docRef.path}'`;
    if (!snapshot.exists) {
      throw new Error(`No Firestore metadata document found: read ${where}`);
    }
    const metadata = this.metadataFromFirestoreData(snapshot.data() as IDocumentMetadata);
    if (!metadata) {
      throw new Error(`Firestore metadata document failed validation (see logged typecheck error): read ${where}`);
    }
    // Preserve the class scoping the previous query enforced (context_id == classHash). The security
    // rules also let teachers get network/other-class docs, but openDocument's callers expect only
    // the current user's class, so reject a mismatch just as the empty class-scoped query did.
    if (metadata.context_id !== classHash) {
      throw new Error(
        `Firestore metadata document context_id '${metadata.context_id}' does not match ` +
        `class '${classHash}': read ${where}`);
    }
    return metadata;
  }
}
