import { ObservableSet, makeAutoObservable, runInAction } from "mobx";
import { DocumentModelType } from "../document/document";
import { isSortableType } from "../document/document-types";
import { DocumentsModelType } from "./documents";
import { GroupsModelType } from "./groups";
import { ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { AppConfigModelType } from "./app-config-model";

type SortedDocument = {
  sectionLabel: string;
  documents: DocumentModelType[];
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
}

export class SortedDocuments {
  stores: ISortedDocumentsStores;
  tempTagDocumentMap = new Map<string, Set<string>>();

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
      const sectionLabel = (user && user.type === "student") ? `${user.lastName}, ${user.firstName}` : "Teacher";
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
    const uniqueDocKeysWithComments = new Set<string>();

    this.tempTagDocumentMap.forEach((docKeysSet, tag) => {
      docKeysSet.forEach((docKey: string) =>{
        uniqueDocKeysWithComments.add(docKey);
      });
      const docKeysArray = Array.from(docKeysSet); // Convert the Set to an array
      if (tagsWithDocs[tag]) {
        tagsWithDocs[tag].docKeysFoundWithTag = docKeysArray;
      }
    });

    const allSortableDocKeys = this.filteredDocsByType;
    allSortableDocKeys.forEach(doc => {
      if (!uniqueDocKeysWithComments.has(doc.key)) {
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
      const docsSnapshot = await db.collection("documents").where("key", "==", doc.key).get();
      docsSnapshot.docs.forEach(async docSnapshot => {
        const commentsSnapshot = await docSnapshot.ref.collection("comments").get();
        runInAction(() => {
          commentsSnapshot.docs.forEach(commentDoc => {
            const commentData = commentDoc.data();
            if (commentData?.tags) {
              commentData.tags.forEach((tag: string) => {
                let docKeysSet = this.tempTagDocumentMap.get(tag);
                if (!docKeysSet) {
                  docKeysSet = new ObservableSet<string>();
                  this.tempTagDocumentMap.set(tag, docKeysSet);
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
      const sectionLabel = doc.isStarred ? "Bookmarked" : "Not Bookmarked";
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
}