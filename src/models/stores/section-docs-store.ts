import { makeAutoObservable } from "mobx";
import { DocumentModelType } from "../document/document";
import { isUnpublishedType, isPublishedType } from "../document/document-types";
import { NavTabSectionModelType, ENavTabOrder } from "../view/nav-tabs";
import { Bookmarks } from "./bookmarks";
import { ClassModelType } from "./class";
import { DocumentsModelType } from "./documents";
import { UserModelType } from "./user";

export interface ISectionDocumentsStores {
  bookmarks: Bookmarks;
  class: ClassModelType;
  documents: DocumentsModelType;
  user: UserModelType;
}

interface IMatchPropertiesOptions {
  isTeacherDocument?: boolean;
}

export class SectionDocuments {
  stores: ISectionDocumentsStores;

  constructor(stores: ISectionDocumentsStores) {
    makeAutoObservable(this);
    this.stores = stores;
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
        return this.stores.bookmarks.isDocumentBookmarked(doc.key) === wantsProperty;
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
    return this.stores.class.isTeacher(doc.uid);
  }

  getSectionDocs(section: NavTabSectionModelType): DocumentModelType[] {
    let sectDocs: DocumentModelType[] = [];
    (section.documentTypes || []).forEach(type => {
      if (isUnpublishedType(type)) {
        sectDocs.push(...this.stores.documents.byTypeForUser(type as any, this.stores.user.id));
      }
      else if (isPublishedType(type)) {
        const publishedDocs: { [source: string]: DocumentModelType[] } = {};
        this.stores.documents
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
