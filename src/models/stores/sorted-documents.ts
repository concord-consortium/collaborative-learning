import { makeAutoObservable, runInAction, IObservableArray, observable } from "mobx";
import { isSortableType } from "../document/document-types";
import { DocumentsModelType } from "./documents";
import { GroupsModelType } from "./groups";
import { ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { AppConfigModelType } from "./app-config-model";
import { Bookmarks } from "./bookmarks";
import { UserModelType } from "./user";
import { IDocumentMetadata } from "../../../functions/src/shared";
import { typeConverter } from "../../utilities/db-utils";
import {
  createDocMapByBookmarks,
  createDocMapByGroups,
  createDocMapByNames,
  createTileTypeToDocumentsMap,
  getTagsWithDocs,
  DocumentCollection,
  sortGroupSectionLabels,
  sortNameSectionLabels
} from "../../utilities/sort-document-utils";
import { DocumentGroup } from "./sorted-documents-documents-group";
import { getTileContentInfo } from "../tiles/tile-content-info";


export type SortedDocumentsMap = Record<string, DocumentCollection[]>;

export type TagWithDocs = {
  tagKey: string;
  tagValue: string;
  docKeysFoundWithTag: string[];
};

export interface ISortedDocumentsStores {
  documents: DocumentsModelType;
  groups: GroupsModelType;
  class: ClassModelType;
  db: DB;
  appConfig: AppConfigModelType;
  bookmarks: Bookmarks;
  user: UserModelType;
}

export class SortedDocuments {
  stores: ISortedDocumentsStores;
  firestoreTagDocumentMap = new Map<string, Set<string>>();
  firestoreMetadataDocs: IObservableArray<IDocumentMetadata> = observable.array([]);

  constructor(stores: ISortedDocumentsStores) {
    makeAutoObservable(this);
    this.stores = stores;
  }

  get bookmarksStore() {
    return this.stores.bookmarks;
  }
  get class(): ClassModelType {
    return this.stores.class;
  }
  get commentTags(): Record<string, string> | undefined {
    return this.stores.appConfig.commentTags;
  }
  get db(): DB {
    return this.stores.db;
  }
  get documents(): DocumentsModelType {
    return this.stores.documents;
  }
  get filteredDocsByType(): IDocumentMetadata[] {
    return this.firestoreMetadataDocs.filter((doc: IDocumentMetadata) => {
      return isSortableType(doc.type);
    });
  }
  get groupsStore(): GroupsModelType {
    return this.stores.groups;
  }
  get user() {
    return this.stores.user;
  }

  // ** views ** //
  get byGroup(): DocumentGroup[] {
    const documentMap = createDocMapByGroups(this.filteredDocsByType, this.groupsStore.groupForUser);
    const sortedSectionLabels = sortGroupSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map(label => {
      return new DocumentGroup({stores: this.stores, label, metaDataDocs: documentMap.get(label).documents });
    });
  }
  get byName(): DocumentGroup[] {
    const documentMap = createDocMapByNames(this.filteredDocsByType, this.class.getUserById);
    const sortedSectionLabels = sortNameSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map(label => {
      return new DocumentGroup({ stores: this.stores, label, metaDataDocs: documentMap.get(label).documents });
    });
  }

  get byStrategy(): DocumentGroup[] {
    const commentTags = this.commentTags;
    const tagsWithDocs = getTagsWithDocs(this.firestoreMetadataDocs, commentTags, this.firestoreTagDocumentMap);

    const sortedDocsArr: DocumentGroup[] = [];
    Object.entries(tagsWithDocs).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const label = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = this.firestoreMetadataDocs.filter((doc: IDocumentMetadata) => docKeys.includes(doc.key));
      sortedDocsArr.push(new DocumentGroup({ stores: this.stores, label, metaDataDocs: documents }));
    });
    return sortedDocsArr;
  }

  get byTools(): DocumentGroup[] {
    const tileTypeToDocumentsMap = createTileTypeToDocumentsMap(this.firestoreMetadataDocs);

    const sectionedDocuments = Array.from(tileTypeToDocumentsMap.keys()).map(tileType => {

      const contentInfo = getTileContentInfo(tileType);
      const label = contentInfo?.displayName || tileType;
      const documents = tileTypeToDocumentsMap.get(tileType)?.documents ?? [];
      const icon = tileTypeToDocumentsMap.get(tileType)?.icon;
      const section = new DocumentGroup({ stores: this.stores, label, metaDataDocs: documents, icon });
      return section;
    });

    // Sort the tile types. 'No Tools' should be at the end.
    const sortedByLabel = sectionedDocuments.sort((a, b) => {
      if (a.label === "No Tools") return 1;   // Move 'No Tools' to the end
      if (b.label === "No Tools") return -1;  // Alphabetically sort all others
      return a.label.localeCompare(b.label);
    });

    return sortedByLabel;
  }

  get byBookmarked(): DocumentGroup[] {
    const documentMap = createDocMapByBookmarks(this.firestoreMetadataDocs, this.bookmarksStore);

    const sortedSectionLabels = ["Bookmarked", "Not Bookmarked"];
    return sortedSectionLabels.filter(label => documentMap.has(label))
                              .map(label => new DocumentGroup({
                                stores: this.stores,
                                label,
                                metaDataDocs: documentMap.get(label).documents
                              }));
  }

  async updateMetaDataDocs (filter: string, unit: string, investigation: number, problem: number) {
    const db = this.db.firestore;
    const converter = typeConverter<IDocumentMetadata>();
    let query = db.collection("documents").withConverter(converter).where("context_id", "==", this.user.classHash);

    if (filter !== "All") {
      query = query.where("unit" , "==", unit);
    }
    if (filter === "Investigation" || filter === "Problem") {
      query = query.where("investigation", "==", String(investigation));
    }
    if (filter === "Problem") {
      query = query.where("problem", "==", String(problem));
    }
    const queryForUnitNull = db.collection("documents").withConverter(converter)
                                                       .where("context_id", "==", this.user.classHash)
                                                       .where("unit" , "==", null);
    const [docsWithUnit, docsWithoutUnit] = await Promise.all([query.get(), queryForUnitNull.get()]);
    const docsArray: IDocumentMetadata[] = [];

    const matchedDocKeys = new Set<string>();
    docsWithUnit.docs.forEach(doc => {
      if (matchedDocKeys.has(doc.data().key)) return;
      docsArray.push(doc.data());
      matchedDocKeys.add(doc.data().key);
    });
    docsWithoutUnit.docs.forEach(doc => {
      if (matchedDocKeys.has(doc.data().key)) return;
      docsArray.push(doc.data());
      matchedDocKeys.add(doc.data().key);
    });

    runInAction(() => {
      this.firestoreMetadataDocs.replace(docsArray);
    });
  }

  async fetchFullDocument(docKey: string) {
    const metadataDoc = this.firestoreMetadataDocs.find(doc => doc.key === docKey);
    if (!metadataDoc) return;

    const unit = metadataDoc?.unit ?? undefined;
    const props = {
      documentKey: metadataDoc?.key,
      type: metadataDoc?.type as any,
      title: metadataDoc?.title || undefined,
      properties: metadataDoc?.properties,
      userId: metadataDoc?.uid,
      groupId: undefined,
      visibility: undefined,
      originDoc: undefined,
      pubVersion: undefined,
      problem: metadataDoc?.problem,
      investigation: metadataDoc?.investigation,
      unit,
    };

    return  this.db.openDocument(props);
  }
}
