import { makeAutoObservable, when } from "mobx";
import { types } from "mobx-state-tree";

import { DB } from "../../lib/db";
import { DocumentMetadataModel, IDocumentMetadataModel } from "../document/document-metadata-model";
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
import { UnitModelType } from "../curriculum/unit";
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

export const MetadataDocMapModel = types.map(DocumentMetadataModel);

export class SortedDocuments {
  stores: ISortedDocumentsStores;
  // Maps from document ID to the history entry ID that the user requested to view.
  documentHistoryViewRequests: Record<string,string> = {};

  // Root document group that serves as the root node for delegating all sorting operations.
  rootDocumentGroup: DocumentGroup;

  constructor(stores: ISortedDocumentsStores) {
    makeAutoObservable(this);
    this.stores = stores;
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

  get docsReceived() {
    return this.stores.documentMetadata.docsReceived;
  }

  get firestoreMetadataDocs() {
    return this.stores.documentMetadata.firestoreMetadataDocs;
  }

  get exemplarMetadataDocs() {
    return this.stores.documentMetadata.exemplarMetadataDocs;
  }

  watchFirestoreMetaDataDocs(filter: string, unit: string, investigation: number, problem: number) {
    return this.stores.documentMetadata.watchFirestoreMetaDataDocs(filter, unit, investigation, problem);
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
