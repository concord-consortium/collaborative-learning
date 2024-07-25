import { IDocumentMetadata } from "functions/src/shared";
import { ISortedDocumentsStores, TagWithDocs } from "./sorted-documents";
import { makeAutoObservable } from "mobx";
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
import { getTileContentInfo } from "../tiles/tile-content-info";
import { getTileComponentInfo } from "../tiles/tile-component-info";

import SparrowHeaderIcon from "../../assets/icons/sort-by-tools/sparrow-id.svg";

export class DocumentGroup {
  stores: ISortedDocumentsStores;
  value: string;
  metaDataDocs: IDocumentMetadata[];
  sortCategory: string; // "Group", "Name", "Strategy", "Bookmark", "Tool"
  firestoreTagDocumentMap = new Map<string, Set<string>>();

  constructor(stores: ISortedDocumentsStores, value: string, metaDataDocs: IDocumentMetadata[], sortCategory: string) {
      makeAutoObservable(this);
      this.stores = stores;
      this.value = value;
      this.metaDataDocs = metaDataDocs;
      this.sortCategory = sortCategory;
  }

  get all(): SortedDocument[] {
    return [{
      sectionLabel: this.value,
      documents: this.metaDataDocs
    }];
  }

  get groups(): SortedDocument[] {
    const documentMap = createDocMapByGroups(this.metaDataDocs, this.stores.groups.groupForUser);
    const sortedSectionLabels = sortGroupSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map(sectionLabel => {
      return {
        sectionLabel,
        documents: documentMap.get(sectionLabel)!.documents
      };
    });
  }

  get names(): SortedDocument[] {
    const documentMap = createDocMapByNames(this.metaDataDocs, this.stores.class.getUserById);
    const sortedSectionLabels = sortNameSectionLabels(Array.from(documentMap.keys()));
    return sortedSectionLabels.map((sectionLabel) =>{
      return {
        sectionLabel,
        documents: documentMap.get(sectionLabel).documents
      };
    });
  }

  get strategies(): SortedDocument[] {
    const commentTags = this.stores.appConfig.commentTags;
    const tagsWithDocs = getTagsWithDocs(this.metaDataDocs, commentTags, this.firestoreTagDocumentMap);

    const sortedDocsArr: SortedDocument[] = [];
    Object.entries(tagsWithDocs).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const sectionLabel = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = this.metaDataDocs.filter((doc: IDocumentMetadata) => docKeys.includes(doc.key));
      sortedDocsArr.push({
        sectionLabel,
        documents
      });
    });
    return sortedDocsArr;
  }

  get tools(): SortedDocument[] {
    const tileTypeToDocumentsMap = createTileTypeToDocumentsMap(this.metaDataDocs);

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

  get bookmarks(): SortedDocument[] {
    const documentMap = createDocMapByBookmarks(this.metaDataDocs, this.stores.bookmarks);
    const sortedSectionLabels = ["Bookmarked", "Not Bookmarked"];
    return sortedSectionLabels.filter(label => documentMap.has(label))
      .map(label => ({
        sectionLabel: label,
        documents: documentMap.get(label).documents
      }));
    }
}
