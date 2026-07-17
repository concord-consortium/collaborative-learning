import { makeAutoObservable } from "mobx";
import { unprotect } from "@concord-consortium/mobx-state-tree";
import { IDocumentMetadata } from "../../../shared/shared";
import { typeConverter } from "../../utilities/db-utils";
import type { DB } from "../../lib/db";
import { MetadataDocMapModel } from "./sorted-documents";

// The subset of the root stores this store needs. The root `Stores` object satisfies it.
export interface IDocumentMetadataStoreStores {
  db: DB;
  user: { classHash: string };
}

/**
 * Class-scoped cache of the Firestore `documents/<key>` metadata docs.
 *
 * It owns the reactive query over the class's metadata (populated by `SortedDocuments`
 * via `watchFirestoreMetaDataDocs`) and exposes point reads by document key. A read is a
 * cache hit when the reactive query has already loaded the doc; otherwise it falls back to
 * a single point query. Concurrent point reads for the same key are coalesced.
 */
export class DocumentMetadataStore {
  stores: IDocumentMetadataStoreStores;
  metadataDocsFiltered = MetadataDocMapModel.create();
  metadataDocsWithoutUnit = MetadataDocMapModel.create();
  docsReceived = false;

  private inFlightPointReads = new Map<string, Promise<IDocumentMetadata | undefined>>();

  constructor(stores: IDocumentMetadataStoreStores) {
    makeAutoObservable(this);
    this.stores = stores;
    // We only want MobX observability + MST serialization, not MST actions, on these maps.
    unprotect(this.metadataDocsFiltered);
    unprotect(this.metadataDocsWithoutUnit);
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
