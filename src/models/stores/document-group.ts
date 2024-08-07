import { FC, SVGProps } from "react";
import { IDocumentMetadata } from "functions/src/shared";
import { ISortedDocumentsStores, TagWithDocs } from "./sorted-documents";
import { makeAutoObservable } from "mobx";
import {
  createDocMapByBookmarks,
  createDocMapByGroups,
  createDocMapByNames,
  createTileTypeToDocumentsMap,
  getTagsWithDocs,
  sortGroupSectionLabels,
  sortNameSectionLabels
} from "../../utilities/sort-document-utils";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { getTileComponentInfo } from "../tiles/tile-component-info";
import { SecondarySortType } from "./ui-types";

import SparrowHeaderIcon from "../../assets/icons/sort-by-tools/sparrow-id.svg";

interface IDocumentGroup {
  icon?:FC<SVGProps<SVGSVGElement>>;
  label: string;
  documents: IDocumentMetadata[];
  stores: ISortedDocumentsStores;
}

/*
 * DocumentGroup
 *
 * Represents a collection of related metadata documents, allowing for various
 * sorting options to organize these documents based on different criteria.
 *
 * Provides methods to sort and group documents by:
 * - Groups
 * - Names
 * - Strategies
 * - Tools
 * - Bookmarks
 *
 * Its main purpose is to provide sub sorting options for documents that are already
 * sorted by a primary sort filter.
 *
 */
export class DocumentGroup {
  stores: ISortedDocumentsStores;
  label: string;
  documents: IDocumentMetadata[];
  firestoreTagDocumentMap = new Map<string, Set<string>>();
  icon?: FC<SVGProps<SVGSVGElement>>;

  constructor(props: IDocumentGroup) {
    makeAutoObservable(this);
    const { stores, label, documents, icon } = props;
    this.stores = stores;
    this.label = label;
    this.documents = documents;
    this.icon = icon;
  }

  buildDocumentCollection(sortedSectionLabels: string[], docMap: Map<string, IDocumentMetadata[]>): DocumentGroup[] {
    return sortedSectionLabels.map(label => {
      return new DocumentGroup({
        label,
        documents: docMap.get(label) ?? [],
        stores: this.stores
      });
    });
  }

  sortBy(sortType: SecondarySortType): DocumentGroup[] {
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

  get byGroup(): DocumentGroup[] {
    const docMap = createDocMapByGroups(this.documents, this.stores.groups.groupForUser);
    const sortedSectionLabels = sortGroupSectionLabels(Array.from(docMap.keys()));
    return this.buildDocumentCollection(sortedSectionLabels, docMap);
  }

  get byName(): DocumentGroup[] {
    const docMap = createDocMapByNames(this.documents, this.stores.class.getUserById);
    const sortedSectionLabels = sortNameSectionLabels(Array.from(docMap.keys()));
    return this.buildDocumentCollection(sortedSectionLabels, docMap);
  }

  get byStrategy(): DocumentGroup[] {
    const commentTags = this.stores.appConfig.commentTags;
    const tagsWithDocs = getTagsWithDocs(this.documents, commentTags, this.firestoreTagDocumentMap);

    const sortedDocsArr: DocumentGroup[] = [];
    Object.entries(tagsWithDocs).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const label = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = this.documents.filter((doc: IDocumentMetadata) => docKeys.includes(doc.key));
      sortedDocsArr.push(new DocumentGroup({
        label,
        documents,
        stores: this.stores
      }));
    });
    return sortedDocsArr;
  }

  get byTools(): DocumentGroup[] {
    const tileTypeToDocumentsMap = createTileTypeToDocumentsMap(this.documents);

    // Map the tile types to their display names
    const sectionedDocuments = Array.from(tileTypeToDocumentsMap.keys()).map(tileType => {
      const section: DocumentGroup = new DocumentGroup({
        label: tileType,
        documents: tileTypeToDocumentsMap.get(tileType)?.documents ?? [],
        stores: this.stores
      });
      if (tileType === "Sparrow") {
        section.icon = SparrowHeaderIcon;
      } else {
        const contentInfo = getTileContentInfo(tileType);
        section.label = contentInfo?.displayName || tileType;
        const componentInfo = getTileComponentInfo(tileType);
        section.icon = componentInfo?.HeaderIcon;
      }
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
    const docMap = createDocMapByBookmarks(this.documents, this.stores.bookmarks);
    const sortedSectionLabels = ["Bookmarked", "Not Bookmarked"];
    return this.buildDocumentCollection(sortedSectionLabels, docMap);
  }
}
