import { makeAutoObservable, runInAction, IObservableArray, observable } from "mobx";
import { isSortableType } from "../document/document-types";
import { DocumentsModelType } from "./documents";
import { GroupsModelType } from "./groups";
import { ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { AppConfigModelType } from "./app-config-model";
import { Bookmarks } from "./bookmarks";
import { UserModelType } from "./user";
import { IDocumentMetadata } from "../../../shared/shared";
import { typeConverter } from "../../utilities/db-utils";
import {
  createDocMapByBookmarks,
  createDocMapByGroups,
  createDocMapByNames,
  createTileTypeToDocumentsMap,
  getTagsWithDocs,
  sortGroupSectionLabels,
  sortNameSectionLabels
} from "../../utilities/sort-document-utils";
import { DocumentGroup } from "./document-group";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { PrimarySortType } from "./ui-types";
import { IArrowAnnotation } from "../annotations/arrow-annotation";

export type SortedDocumentsMap = Record<string, DocumentGroup[]>;

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

  sortBy(sortType: PrimarySortType): DocumentGroup[] {
    switch (sortType) {
      case "Group":
        return this.byGroup;
      case "Name":
        return this.byName;
      case "Strategy":
        return this.byStrategy;
      case "Tools":
        return this.byTools;
      case "Bookmarked":
        return this.byBookmarked;
      default:
        return [];
    }
  }

  // ** views ** //
  get byGroup(): DocumentGroup[] {
    const documentMap = createDocMapByGroups(this.filteredDocsByType, this.groupsStore.groupForUser);
    const sortedSectionLabels = sortGroupSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map(label => {
      return new DocumentGroup({stores: this.stores, label, documents: documentMap.get(label) ?? [] });
    });
  }
  get byName(): DocumentGroup[] {
    const documentMap = createDocMapByNames(this.filteredDocsByType, this.class.getUserById);
    const sortedSectionLabels = sortNameSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map(label => {
      return new DocumentGroup({ stores: this.stores, label, documents: documentMap.get(label) ?? [] });
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
      sortedDocsArr.push(new DocumentGroup({ stores: this.stores, label, documents }));
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
      const section = new DocumentGroup({ stores: this.stores, label, documents, icon });
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
                                documents: documentMap.get(label) ?? []
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

    // Add Exemplar documents, which should have been loaded into the documents
    // store but are not found in the firestore query -- they are authored as
    // content, not found in the database.
    this.stores.documents.exemplarDocuments.forEach(doc => {
      const exemplarStrategy = doc.properties.get('authoredCommentTag');

      const tools: string[] = [];
      const contentTileTypes = doc.content?.tileTypes || [];
      const annotationsArray = Array.from(doc.content?.annotations || []);
      const annotationTypes = annotationsArray.map(([key, annotation]: [string, IArrowAnnotation]) => annotation.type);
      contentTileTypes.forEach(tileType => tools.push(tileType));
      if (annotationTypes.includes("arrowAnnotation")) {
        tools.push("Sparrow");
      }

      const metadata: IDocumentMetadata = {
        uid: doc.uid,
        type: doc.type,
        key: doc.key,
        createdAt: doc.createdAt,
        title: doc.title,
        properties: undefined,
        tools,
        strategies: exemplarStrategy ? [exemplarStrategy] : [],
        investigation: doc.investigation,
        problem: doc.problem,
        unit: doc.unit
      };
      docsArray.push(metadata);
    });

    runInAction(() => {
      this.firestoreMetadataDocs.replace(docsArray);
    });
  }

  async fetchFullDocument(docKey: string) {
    const metadataDoc = this.firestoreMetadataDocs.find(doc => doc.key === docKey);
    if (!metadataDoc) return;

    const unit = metadataDoc?.unit ?? undefined;
    const visibility = metadataDoc?.visibility === "public" || metadataDoc?.visibility === "private"
                         ? metadataDoc?.visibility as "public" | "private"
                         : undefined;
    const props = {
      documentKey: metadataDoc?.key,
      type: metadataDoc?.type as any,
      title: metadataDoc?.title || undefined,
      properties: metadataDoc?.properties,
      userId: metadataDoc?.uid,
      groupId: undefined,
      visibility,
      originDoc: undefined,
      pubVersion: undefined,
      problem: metadataDoc?.problem,
      investigation: metadataDoc?.investigation,
      unit,
    };

    return  this.db.openDocument(props);
  }
}
