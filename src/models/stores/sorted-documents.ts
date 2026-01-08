import { makeAutoObservable, runInAction, when } from "mobx";
import { types, Instance, SnapshotIn, applySnapshot, typecheck, unprotect } from "mobx-state-tree";
import { union } from "lodash";
import firebase from "firebase";
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
import { CurriculumConfigType } from "./curriculum-config";

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
  curriculumConfig: CurriculumConfigType;
}

/**
 * This is the serializable version of IDocumentMetadata. It is almost the same. The one
 * important difference is the `properties` property.
 * In this MST model that property is an `observable.map<string, string>`.
 * In the IDocumentMetadata it is a Record<string,string>.
 */
export const DocumentMetadataModel = types.model("DocumentMetadata", {
  uid: types.string,
  type: types.string,
  key: types.identifier,
  createdAt: types.maybe(types.number),
  groupId: types.maybe(types.string),
  title: types.maybeNull(types.string),
  originDoc: types.maybeNull(types.string),
  properties: types.map(types.string),
  tools: types.array(types.string),
  strategies: types.array(types.string),
  investigation: types.maybeNull(types.string),
  problem: types.maybeNull(types.string),
  unit: types.maybeNull(types.string),
  visibility: types.maybe(types.string)
})
.views((self) => ({
  getProperty(key: string) {
    return self.properties.get(key);
  },
}));

export interface IDocumentMetadataModel extends Instance<typeof DocumentMetadataModel> {}

export const MetadataDocMapModel = types.map(DocumentMetadataModel);

export class SortedDocuments {
  stores: ISortedDocumentsStores;
  metadataDocsFiltered = MetadataDocMapModel.create();
  metadataDocsWithoutUnit = MetadataDocMapModel.create();
  docsReceived = false;
  // Maps from document ID to the history entry ID that the user requested to view.
  documentHistoryViewRequests: Record<string,string> = {};

  constructor(stores: ISortedDocumentsStores) {
    makeAutoObservable(this);
    this.stores = stores;
    // We don't need the benefits of MST's actions
    // We only want the serialization support
    unprotect(this.metadataDocsFiltered);
    unprotect(this.metadataDocsWithoutUnit);
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
      return new DocumentGroup({
        stores: this.stores,
        sortType: "Group",
        label,
        documents: documentMap.get(label) ?? []
      });
    });
  }
  get byName(): DocumentGroup[] {
    const documentMap = createDocMapByNames(this.filteredDocsByType, this.class.getUserById);
    const sortedSectionLabels = sortNameSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map(label => {
      return new DocumentGroup({
        stores: this.stores,
        sortType: "Name",
        label,
        documents: documentMap.get(label) ?? []
      });
    });
  }

  get byStrategy(): DocumentGroup[] {
    const commentTags = this.commentTags;
    const tagsWithDocs = getTagsWithDocs(this.firestoreMetadataDocs, commentTags);

    const sortedDocsArr: DocumentGroup[] = [];
    Object.entries(tagsWithDocs).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const label = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = this.firestoreMetadataDocs.filter(doc => docKeys.includes(doc.key));
      sortedDocsArr.push(new DocumentGroup({ stores: this.stores, sortType: "Strategy", label, documents }));
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
      const section = new DocumentGroup({ stores: this.stores, sortType: "Tools", label, documents, icon });
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
                                sortType: "Bookmarked",
                                label,
                                documents: documentMap.get(label) ?? []
                              }));
  }

  getDocSortLabel(docKey: string, sortBy: string): string|undefined {
    const sortKey = `by${sortBy}` as keyof SortedDocuments;
    const sortedDocs = this[sortKey] as DocumentGroup[];
    const docGroup = sortedDocs?.find(group => group.documents.some(doc => doc.key === docKey));
    if (docGroup) {
      return docGroup.label;
    }
  }

  getMSTSnapshotFromFBSnapshot(snapshot: firebase.firestore.QuerySnapshot<IDocumentMetadata>) {
    const mstSnapshot: SnapshotIn<typeof MetadataDocMapModel> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      mstSnapshot[data.key] = data;
      // For some reason some docs arrive with visibility set to illegal "null" value.
      if (data.visibility === null) data.visibility = undefined;
      typecheck(DocumentMetadataModel, data);
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
      const contentTileTypes = doc.content?.tileTypes || [];
      const annotationsArray = Array.from(doc.content?.annotations || []);
      const annotationTypes = annotationsArray.map(([key, annotation]: [string, IArrowAnnotation]) => annotation.type);
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
      properties: metadataDoc.properties.toJSON()
    });
  }
}
