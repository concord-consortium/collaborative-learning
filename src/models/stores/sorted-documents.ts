import { makeAutoObservable, runInAction, when } from "mobx";
import { applySnapshot, unprotect } from "@concord-consortium/mobx-state-tree";

import { IDocumentMetadata } from "../../../shared/shared";
import { DB } from "../../lib/db";
import { typeConverter } from "../../utilities/db-utils";
import { UnitModelType } from "../curriculum/unit";
import { IDocumentMetadataModel, MetadataDocMapModel } from "../document/document-metadata-model";
import { isSortableType } from "../document/document-types";
import { AppConfigModelType } from "./app-config-model";
import { Bookmarks } from "./bookmarks";
import { CommentTags } from "./comment-tags";
import { ClassModelType } from "./class";
import { CurriculumConfigType } from "./curriculum-config";
import { DocumentGroup } from "./document-group";
import { DocumentsModelType } from "./documents";
import { GroupsModelType } from "./groups";
import { PrimarySortType } from "./ui-types";
import { UserModelType } from "./user";
import { DocumentMetadataStore } from "./document-metadata-store";

export type SortedDocumentsMap = Record<string, DocumentGroup[]>;

export interface ISortedDocumentsStores {
  documents: DocumentsModelType;
  groups: GroupsModelType;
  class: ClassModelType;
  db: DB;
  appConfig: AppConfigModelType;
  bookmarks: Bookmarks;
  commentTags: CommentTags;
  user: UserModelType;
  curriculumConfig: CurriculumConfigType;
  unit?: UnitModelType;
  documentMetadata: DocumentMetadataStore;
}

export class SortedDocuments {
  stores: ISortedDocumentsStores;
  metadataDocsFiltered = MetadataDocMapModel.create();
  // `metadataDocsWithoutUnit` picks up unit-less docs (e.g. personal documents) when a unit
  // filter is applied.
  metadataDocsWithoutUnit = MetadataDocMapModel.create();
  docsReceived = false;
  // Maps from document ID to the history entry ID that the user requested to view.
  documentHistoryViewRequests: Record<string,string> = {};

  // Root document group that serves as the root node for delegating all sorting operations.
  rootDocumentGroup: DocumentGroup;

  constructor(stores: ISortedDocumentsStores) {
    makeAutoObservable(this);
    this.stores = stores;
    // We only want MobX observability + MST serialization, not MST actions, on these maps.
    unprotect(this.metadataDocsFiltered);
    unprotect(this.metadataDocsWithoutUnit);
    this.rootDocumentGroup = new DocumentGroup({
      stores,
      sortType: "All",
      label: "All Documents",
      documents: () => this.filteredDocsByType
    });
  }

  get bookmarksStore() {
    return this.stores.bookmarks;
  }
  get class(): ClassModelType {
    return this.stores.class;
  }
  get commentTags(): Record<string, string> | undefined {
    return this.stores.commentTags.mergedWith(this.stores.appConfig.commentTags);
  }
  get db(): DB {
    return this.stores.db;
  }
  get documents(): DocumentsModelType {
    return this.stores.documents;
  }
  get filteredDocsByType(): IDocumentMetadataModel[] {
    return this.firestoreMetadataDocs.filter((doc) => {
      return isSortableType(doc.type);
    });
  }
  get groupsStore(): GroupsModelType {
    return this.stores.groups;
  }
  get user() {
    return this.stores.user;
  }
  get curriculumConfig() {
    return this.stores.curriculumConfig;
  }

  setDocumentHistoryViewRequest(docKey: string, historyId: string) {
    this.documentHistoryViewRequests[docKey] = historyId;
  }
  getDocumentHistoryViewRequest(docKey: string) {
    // We only want to move to this history entry once,
    // so we delete the request after it has been fulfilled.
    const historyId = this.documentHistoryViewRequests[docKey];
    if (historyId) {
      delete this.documentHistoryViewRequests[docKey];
    }
    return historyId;
  }

  sortBy(sortType: PrimarySortType): DocumentGroup[] {
    return this.rootDocumentGroup.sortBy(sortType);
  }

  watchFirestoreMetaDataDocs(filter: string, unit: string, investigation: number, problem: number) {
    const db = this.db.firestore;
    const converter = typeConverter<IDocumentMetadata>();
    const baseQuery = db.collection("documents")
      .withConverter(converter)
      .where("context_id", "==", this.user.classHash);

    let filteredQuery = baseQuery;

    if (filter !== "All") {
      // an "in" query is used here so that we can find any documents that use unit and
      // any the older renamed unit codes.
      filteredQuery = filteredQuery.where("unit" , "in", this.curriculumConfig.getUnitCodeVariants(unit));
    }
    if (filter === "Investigation" || filter === "Problem") {
      filteredQuery = filteredQuery.where("investigation", "==", String(investigation));
    }
    if (filter === "Problem") {
      filteredQuery = filteredQuery.where("problem", "==", String(problem));
    }

    const disposeFilteredListener = filteredQuery.onSnapshot(snapshot => {
      const mstSnapshot = this.stores.documentMetadata.getMSTSnapshotFromFBSnapshot(snapshot);
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
        const mstSnapshot = this.stores.documentMetadata.getMSTSnapshotFromFBSnapshot(snapshot);
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
    return this.stores.documentMetadata.exemplarMetadataDocs;
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

  // This only fetches documents that have metadata that was already pulled down
  // by the watchFirestoreMetaDataDocs listener.
  async fetchFullDocument(docKey: string) {
    if (!this.docsReceived) {
      // Wait until the initial batch of documents has been received from Firestore.
      await when(() => this.docsReceived);
    }
    const metadataDoc = this.firestoreMetadataDocs.find(doc => doc.key === docKey);
    if (!metadataDoc) {
      console.warn("Could not find metadata doc with key", docKey, this.firestoreMetadataDocs);
      return;
    }
    return this.db.openDocumentFromFirestoreMetadata({
      ...metadataDoc,
      properties: metadataDoc.propertiesAsStringRecord
    });
  }
}
