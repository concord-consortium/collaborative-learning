import { ObservableSet, makeAutoObservable, runInAction } from "mobx";
import { DocumentModelType } from "../document/document";
import { isPublishedType, isSortableType, isUnpublishedType } from "../document/document-types";
import { DocumentsModelType } from "./documents";
import { GroupsModelType } from "./groups";
import { ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { AppConfigModelType } from "./app-config-model";
import { Bookmarks } from "./bookmarks";
import { ENavTabOrder, NavTabSectionModelType } from "../view/nav-tabs";
import { UserModelType } from "./user";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { getTileComponentInfo } from "../tiles/tile-component-info";

import SparrowHeaderIcon from "../../assets/icons/sort-by-tools/sparrow-id.svg";

export type SortedDocument = {
  sectionLabel: string;
  documents: DocumentModelType[];
  icon?: React.FC<React.SVGProps<SVGSVGElement>>; //exists only in the "sort by tools" case
}

type TagWithDocs = {
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

interface IMatchPropertiesOptions {
  isTeacherDocument?: boolean;
}
export class SortedDocuments {
  stores: ISortedDocumentsStores;
  firestoreTagDocumentMap = new Map<string, Set<string>>();

  constructor(stores: ISortedDocumentsStores) {
    makeAutoObservable(this);
    this.stores = stores;
  }

  //********************************************* Views *******************************************
  get documents(): DocumentsModelType {
    return this.stores.documents;
  }
  get groups(): GroupsModelType {
    return this.stores.groups;
  }
  get class(): ClassModelType {
    return this.stores.class;
  }
  get db(): DB {
    return this.stores.db;
  }
  get commentTags(): Record<string, string> | undefined {
    return this.stores.appConfig.commentTags;
  }
  get bookmarks() {
    return this.stores.bookmarks;
  }
  get user() {
    return this.stores.user;
  }

  get filteredDocsByType(): DocumentModelType[] {
    return this.documents.all.filter((doc: DocumentModelType) => {
      return isSortableType(doc.type);
    });
  }

  //******************************************* Sort By Group *************************************
  get sortByGroup(): SortedDocument[]{
    const documentMap = new Map();
    this.filteredDocsByType.forEach((doc) => {
      const userId = doc.uid;
      const group = this.groups.groupForUser(userId);
      const sectionLabel =  group ? `Group ${group.id}` : "No Group";
      if (!documentMap.has(sectionLabel)) {
        documentMap.set(sectionLabel, {
          sectionLabel,
          documents: []
        });
      }
      documentMap.get(sectionLabel).documents.push(doc);
    });
    //sort from least to greatest
    const sortedSectionLabels = Array.from(documentMap.keys()).sort((a, b) => {
      const numA = parseInt(a.replace(/^\D+/g, ''), 10);
      const numB = parseInt(b.replace(/^\D+/g, ''), 10);
      return numA - numB;
    });
    return sortedSectionLabels.map(sectionLabel => documentMap.get(sectionLabel));
  }

  //******************************************* Sort By Name **************************************
  get sortByName(): SortedDocument[]{
    const documentMap = new Map();
    this.filteredDocsByType.forEach((doc) => {
      const user = this.class.getUserById(doc.uid);
      const sectionLabel = user && `${user.lastName}, ${user.firstName}`;
      if (!documentMap.has(sectionLabel)) {
        documentMap.set(sectionLabel, {
          sectionLabel,
          documents: []
        });
      }
      documentMap.get(sectionLabel).documents.push(doc);
    });

    const sortedSectionLabels = Array.from(documentMap.keys()).sort((a, b) => {
      const parseName = (name: any) => {
        const [lastName, firstName] = name.split(", ").map((part: any) => part.trim());
        return { firstName, lastName };
      };
      const aParsed = parseName(a);
      const bParsed = parseName(b);

      // Compare by last name, then by first name if last names are equal
      const lastNameCompare = aParsed.lastName.localeCompare(bParsed.lastName);
      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }
      return aParsed.firstName.localeCompare(bParsed.firstName);
    });
    return sortedSectionLabels.map(sectionLabel => documentMap.get(sectionLabel));
  }

  //*************************************** Sort By Strategy **************************************

  get sortByStrategy(): SortedDocument[]{
    const commentTags = this.commentTags;
    const tagsWithDocs: Record<string, TagWithDocs> = {};
    if (commentTags) {
      for (const key of Object.keys(commentTags)) {
        tagsWithDocs[key] = {
          tagKey: key,
          tagValue: commentTags[key],
          docKeysFoundWithTag: []
        };
      }
      tagsWithDocs[""] = { //this accounts for when user commented with tagPrompt (no tag selected)
        tagKey: "",
        tagValue: "Not Tagged",
        docKeysFoundWithTag: []
      };
    }

    // Find all unique document keys in tagsWithDocs. Compare this with all sortable documents
    // in store to find "Documents with no comments" then place those doc keys to "Not Tagged"
    const uniqueDocKeysWithTags = new Set<string>();

    // grouping documents based on firestore comment tags
    this.firestoreTagDocumentMap.forEach((docKeysSet, tag) => {
      const docKeysArray = Array.from(docKeysSet); // Convert the Set to an array
      if (tagsWithDocs[tag]) {
        docKeysSet.forEach((docKey: string) =>{
          uniqueDocKeysWithTags.add(docKey);
        });
        tagsWithDocs[tag].docKeysFoundWithTag = docKeysArray;
      }
    });

    // adding in (exemplar) documents with authored tags
    const allSortableDocKeys = this.filteredDocsByType;
    allSortableDocKeys.forEach(doc => {
      const foundTagKey = doc.getProperty("authoredCommentTag");
      if (foundTagKey !== undefined && foundTagKey !== "") {
        if (tagsWithDocs[foundTagKey]) {
          tagsWithDocs[foundTagKey].docKeysFoundWithTag.push(doc.key);
          uniqueDocKeysWithTags.add(doc.key);
        }
      }
    });

    allSortableDocKeys.forEach(doc => {
      if (!uniqueDocKeysWithTags.has(doc.key)) {
        // This document has no comments
        if (tagsWithDocs[""]) {
          tagsWithDocs[""].docKeysFoundWithTag.push(doc.key);
        }
      }
    });

    const sortedDocsArr: SortedDocument[] = [];
    Object.entries(tagsWithDocs).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const sectionLabel = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = this.documents.all.filter(doc => docKeys.includes(doc.key));
      sortedDocsArr.push({
        sectionLabel,
        documents
      });
    });
    return sortedDocsArr;
  }

  async updateTagDocumentMap () {
    const db = this.db.firestore;
    const filteredDocs = this.filteredDocsByType;
    filteredDocs.forEach(async doc => {
      const docsSnapshot = await db.collection("documents").where("key", "==", doc.key)
                           .where("context_id", "==", this.user.classHash).get();
      docsSnapshot.docs.forEach(async docSnapshot => {
        const commentsSnapshot = await docSnapshot.ref.collection("comments").get();
        runInAction(() => {
          commentsSnapshot.docs.forEach(commentDoc => {
            const commentData = commentDoc.data();
            if (commentData?.tags) {
              commentData.tags.forEach((tag: string) => {
                let docKeysSet = this.firestoreTagDocumentMap.get(tag);
                if (!docKeysSet) {
                  docKeysSet = new ObservableSet<string>();
                  this.firestoreTagDocumentMap.set(tag, docKeysSet);
                }
                docKeysSet.add(doc.key);
              });
            }
          });
        });
      });
    });
  }

  //*************************************** Sort By Bookmarks *************************************

  get sortByBookmarks(): SortedDocument[] {
    const documentMap = new Map();
    this.filteredDocsByType.forEach((doc) => {
      const sectionLabel = this.bookmarks.isDocumentBookmarked(doc.key) ? "Bookmarked" : "Not Bookmarked";
      if (!documentMap.has(sectionLabel)) {
        documentMap.set(sectionLabel, {
          sectionLabel,
          documents: []
        });
      }
      documentMap.get(sectionLabel).documents.push(doc);
    });

    const sortedSectionLabels = ["Bookmarked", "Not Bookmarked"];
    return sortedSectionLabels.filter(label => documentMap.has(label)).map(label => documentMap.get(label));
  }

  //**************************************** Sort By Tools ****************************************

  get sortByTools(): SortedDocument[] {
    const tileTypeToDocumentsMap: Record<string, DocumentModelType[]> = {};

    const addDocByType = (docToAdd: DocumentModelType, type: string) => {
      if (!tileTypeToDocumentsMap[type]) {
        tileTypeToDocumentsMap[type] = [];
      }
      tileTypeToDocumentsMap[type].push(docToAdd);
    };

    //Iterate through all documents, determine if they are valid,
    //create a map of valid ones, otherwise put them into the "No Tools" section
    this.filteredDocsByType.forEach((doc) => {
      const tilesByTypeMap = doc.content?.getAllTilesByType();
      if (tilesByTypeMap) {
        const tileTypes = Object.keys(tilesByTypeMap);
        const validTileTypes = tileTypes.filter(type => type !== "Placeholder" && type !== "Unknown");
        if (validTileTypes.length > 0) {
          validTileTypes.forEach(tileType => {
            addDocByType(doc, tileType);
          });

          //Assuming validTileTypes, we can check if the document has "Sparrow" annotations
          const docHasAnnotations = doc.content?.annotations && doc.content?.annotations.size > 0;
          if(docHasAnnotations){
            addDocByType(doc, "Sparrow");
          }
        } else { //Documents with only all Placeholder or Unknown tiles
          addDocByType(doc, "No Tools");
        }
      }
    });

    // Map the tile types to their display names
    const sectionedDocuments = Object.keys(tileTypeToDocumentsMap).map(tileType => {
      const section: SortedDocument = {
        sectionLabel: tileType,
        documents: tileTypeToDocumentsMap[tileType],
      };
      if (tileType === "Sparrow") {
        section.icon = SparrowHeaderIcon;
      } else {
        const contentInfo = getTileContentInfo(tileType);
        section.sectionLabel = contentInfo?.displayName || tileType;
        const componentInfo = getTileComponentInfo(tileType);
        section.icon = componentInfo?.HeaderIcon;
      }
      return section;
    });

    // Sort the tile types. 'No Tools' should be at the end.
    const sortedByLabel = sectionedDocuments.sort((a, b) => {
      if (a.sectionLabel === "No Tools") return 1;   // Move 'No Tools' to the end
      if (b.sectionLabel === "No Tools") return -1;  // Alphabetically sort all others
      return a.sectionLabel.localeCompare(b.sectionLabel);
    });

    return sortedByLabel;
  }

  matchProperties(doc: DocumentModelType, properties?: readonly string[], options?: IMatchPropertiesOptions) {
    // if no properties specified then consider it a match
    if (!properties?.length) return true;
    return properties?.every(p => {
      const match = /(!)?(.*)/.exec(p);
      const property = match && match[2];
      const wantsProperty = !(match && match[1]); // not negated => has property
      // treat "starred" as a virtual property
      // This will be a problem if we extract starred
      if (property === "starred") {
        return this.bookmarks.isDocumentBookmarked(doc.key) === wantsProperty;
      }
      if (property === "isTeacherDocument") {
        return !!options?.isTeacherDocument === wantsProperty;
      }
      if (property) {
        return !!doc.getProperty(property) === wantsProperty;
      }
      // ignore empty strings, etc.
      return true;
    });
  }

  isMatchingSpec(doc: DocumentModelType, type: string, properties?: readonly string[]) {
    return (type === doc.type) && this.matchProperties(doc, properties);
  }

  isTeacherDocument(doc: DocumentModelType){
    return this.class.isTeacher(doc.uid);
  }

  getSectionDocs(section: NavTabSectionModelType): DocumentModelType[] {
    let sectDocs: DocumentModelType[] = [];
    (section.documentTypes || []).forEach(type => {
      if (isUnpublishedType(type)) {
        sectDocs.push(...this.documents.byTypeForUser(type as any, this.user.id));
      }
      else if (isPublishedType(type)) {
        const publishedDocs: { [source: string]: DocumentModelType[] } = {};
        this.documents
          .byType(type as any)
          .forEach(doc => {
            // personal documents and learning logs have originDocs.
            // problem documents only have the uids of their creator,
            // but as long as we're scoped to a single problem, there
            // shouldn't be published documents from other problems.
            const source = doc.originDoc || doc.uid;
            if (source) {
              if (!publishedDocs.source) {
                publishedDocs.source = [];
              }
              publishedDocs.source.push(doc);
            }
          });
        for (const sourceId in publishedDocs) {
          sectDocs.push(...publishedDocs[sourceId]);
        }
      }
    });
    // Reverse the order to approximate a most-recently-used ordering.
    if (section.order === ENavTabOrder.kReverse) {
      sectDocs = sectDocs.reverse();
    }
    // filter by additional properties
    if (section.properties && section.properties.length) {
      sectDocs = sectDocs.filter(doc => this.matchProperties(doc, section.properties,
                                                            { isTeacherDocument: this.isTeacherDocument(doc) }));
    }
    return sectDocs;
  }

}
