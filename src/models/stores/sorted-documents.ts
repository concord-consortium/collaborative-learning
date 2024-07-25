import { makeAutoObservable, runInAction, IObservableArray, observable } from "mobx";
import { isSortableType } from "../document/document-types";
import { DocumentsModelType } from "./documents";
import { GroupsModelType } from "./groups";
import { ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { AppConfigModelType } from "./app-config-model";
import { Bookmarks } from "./bookmarks";
import { UserModelType } from "./user";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { IDocumentMetadata } from "../../../functions/src/shared";
import { typeConverter } from "../../utilities/db-utils";
import {
  createDocMapByBookmarks,
  createDocMapByGroups,
  createDocMapByNames,
  createTileTypeToDocumentsMap,
  getTagsWithDocs,
  SortedDocument,
  sortGroupSectionLabels,
  sortNameSectionLabels
} from "../../utilities/sort-document-utils";
import { DocumentGroup } from "./sorted-documents-documents-group";


export type SortedDocumentsMap = Record<string, SortedDocument[]>;

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
  get groups(): DocumentGroup[] {
    const documentMap = createDocMapByGroups(this.filteredDocsByType, this.groupsStore.groupForUser);
    const sortedSectionLabels = sortGroupSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map(sectionLabel => {
      return new DocumentGroup(this.stores, sectionLabel, documentMap.get(sectionLabel), "group");
    });
  }
  get names(): DocumentGroup[] {
    const documentMap = createDocMapByNames(this.filteredDocsByType, this.class.getUserById);
    const sortedSectionLabels = sortNameSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map((sectionLabel) =>{
      return new DocumentGroup(this.stores, sectionLabel, documentMap.get(sectionLabel).documents, "name");
    });
  }

  get strategies(): DocumentGroup[] {
    const commentTags = this.commentTags;
    const tagsWithDocs = getTagsWithDocs(this.firestoreMetadataDocs, commentTags, this.firestoreTagDocumentMap);

    const sortedDocsArr: DocumentGroup[] = [];
    Object.entries(tagsWithDocs).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const sectionLabel = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = this.firestoreMetadataDocs.filter((doc: IDocumentMetadata) => docKeys.includes(doc.key));
      sortedDocsArr.push(new DocumentGroup(this.stores, sectionLabel, documents, "strategy"));
    });
    return sortedDocsArr;
  }

  get tools(): DocumentGroup[] {
    const tileTypeToDocumentsMap = createTileTypeToDocumentsMap(this.firestoreMetadataDocs);

    const sectionedDocuments = Object.keys(tileTypeToDocumentsMap).map(tileType => {
      const contentInfo = getTileContentInfo(tileType);
      const value = contentInfo?.displayName || tileType;
      const section: DocumentGroup = new DocumentGroup(this.stores, value, tileTypeToDocumentsMap[tileType], "tool");
      return section;
    });

    // Sort the tile types. 'No Tools' should be at the end.
    const sortedByLabel = sectionedDocuments.sort((a, b) => {
      if (a.value === "No Tools") return 1;   // Move 'No Tools' to the end
      if (b.value === "No Tools") return -1;  // Alphabetically sort all others
      return a.value.localeCompare(b.value);
    });

    return sortedByLabel;
  }

  get bookmarks(): DocumentGroup[] {
    const documentMap = createDocMapByBookmarks(this.firestoreMetadataDocs, this.bookmarksStore);

    const sortedSectionLabels = ["Bookmarked", "Not Bookmarked"];
    return sortedSectionLabels.filter(label => documentMap.has(label))
                              .map(label => new DocumentGroup(this.stores,
                                label, documentMap.get(label).documents, "bookmark"));
  }

  sortDocuments (primarySort: string, secondarySort: string) {
    let documentGroups: DocumentGroup[] = [];
    switch (primarySort) {
      case "Group":
        documentGroups = this.groups;
        break;
      case "Name":
        documentGroups = this.names;
        break;
      case "Strategy":
        documentGroups = this.strategies;
        break;
      case "Tool":
        documentGroups = this.tools;
        break;
      case "Bookmark":
        documentGroups = this.bookmarks;
        break;
    }
    const sortedDocuments: SortedDocumentsMap = {};
    switch (secondarySort) {
      case "None":
        documentGroups.forEach(documentGroup => {
          sortedDocuments[documentGroup.value] = documentGroup.all;
        });
        break;
      case "Group":
        documentGroups.forEach(documentGroup => {
          sortedDocuments[documentGroup.value] = documentGroup.groups;
        });
        break;
      case "Name":
        documentGroups.forEach(documentGroup => {
          sortedDocuments[documentGroup.value] = documentGroup.names;
        });
        break;
      case "Strategy":
        documentGroups.forEach(documentGroup => {
          sortedDocuments[documentGroup.value] = documentGroup.strategies;
        });
        break;
      case "Tool":
        documentGroups.forEach(documentGroup => {
          sortedDocuments[documentGroup.value] = documentGroup.tools;
        });
        break;
      case "Bookmark":
        documentGroups.forEach(documentGroup => {
          sortedDocuments[documentGroup.value] = documentGroup.bookmarks;
        });
        break;
    }
    return sortedDocuments;
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
