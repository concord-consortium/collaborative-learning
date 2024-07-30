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
  DocumentCollection,
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
  metaDataDocs: IDocumentMetadata[];
  stores: ISortedDocumentsStores;
}

export class DocumentGroup {
  stores: ISortedDocumentsStores;
  label: string;
  metaDataDocs: IDocumentMetadata[];
  firestoreTagDocumentMap = new Map<string, Set<string>>();
  icon?: FC<SVGProps<SVGSVGElement>>;

  constructor(props: IDocumentGroup) {
    makeAutoObservable(this);
    const { stores, label, metaDataDocs, icon } = props;
    this.stores = stores;
    this.label = label;
    this.metaDataDocs = metaDataDocs;
    this.icon = icon;
  }

  buildDocumentCollection(
    sortedSectionLabels: string[], docMap: Map<any, any>
  ): DocumentCollection[] {
    return sortedSectionLabels.map(label => {
      return {
        label,
        documents: docMap.get(label) ?? []
      };
    });
  }

  sortBy(sortType: SecondarySortType): DocumentCollection[] {
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

  get byGroup(): DocumentCollection[] {
    const documentMap = createDocMapByGroups(this.metaDataDocs, this.stores.groups.groupForUser);
    const sortedSectionLabels = sortGroupSectionLabels(Array.from(documentMap.keys()));
    return this.buildDocumentCollection(sortedSectionLabels, documentMap);
  }

  get byName(): DocumentCollection[] {
    const documentMap = createDocMapByNames(this.metaDataDocs, this.stores.class.getUserById);
    const sortedSectionLabels = sortNameSectionLabels(Array.from(documentMap.keys()));
    return this.buildDocumentCollection(sortedSectionLabels, documentMap);
  }

  get byStrategy(): DocumentCollection[] {
    const commentTags = this.stores.appConfig.commentTags;
    const tagsWithDocs = getTagsWithDocs(this.metaDataDocs, commentTags, this.firestoreTagDocumentMap);

    const sortedDocsArr: DocumentCollection[] = [];
    Object.entries(tagsWithDocs).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const label = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = this.metaDataDocs.filter((doc: IDocumentMetadata) => docKeys.includes(doc.key));
      sortedDocsArr.push({
        label,
        documents
      });
    });
    return sortedDocsArr;
  }

  get byTools(): DocumentCollection[] {
    const tileTypeToDocumentsMap = createTileTypeToDocumentsMap(this.metaDataDocs);

    // Map the tile types to their display names
    const sectionedDocuments = Array.from(tileTypeToDocumentsMap.keys()).map(tileType => {
      const section: DocumentCollection = {
        label: tileType,
        documents: tileTypeToDocumentsMap.get(tileType)?.documents ?? [],
      };
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

  get byBookmarked(): DocumentCollection[] {
    const documentMap = createDocMapByBookmarks(this.metaDataDocs, this.stores.bookmarks);
    const sortedSectionLabels = ["Bookmarked", "Not Bookmarked"];
    return this.buildDocumentCollection(sortedSectionLabels, documentMap);
  }
}
