import { FC, SVGProps } from "react";
import { makeAutoObservable } from "mobx";
import {
  createDocMapByBookmarks,
  createDocMapByGroups,
  createDocMapByNames,
  createTileTypeToDocumentsMap,
  getTagsWithDocs,
  sortDateSectionLabels,
  sortGroupSectionLabels,
  sortNameSectionLabels,
  sortProblemSectionLabels
} from "../../utilities/sort-document-utils";
import { IDocumentMetadataModel } from "../document/document-metadata-model";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { getTileComponentInfo } from "../tiles/tile-component-info";
import { SecondarySortType, SortType } from "./ui-types";
import { GroupsModelType } from "./groups";
import { ClassModelType } from "./class";
import { AppConfigModelType } from "./app-config-model";
import { Bookmarks } from "./bookmarks";

import SparrowHeaderIcon from "../../assets/icons/sort-by-tools/sparrow-id.svg";

interface IDocumentGroupStores {
  groups: GroupsModelType;
  class: ClassModelType;
  appConfig: AppConfigModelType;
  bookmarks: Bookmarks;
}

export type TagWithDocs = {
  tagKey: string;
  tagValue: string;
  docKeysFoundWithTag: string[];
};

interface IDocumentGroup {
  icon?:FC<SVGProps<SVGSVGElement>>;
  label: string;
  sortType: SortType;

  /**
   * This is either an array of documents or a function that returns an array of documents.
   * The function can be used so an other object can manage the documents and recompute
   * them as needed.
   */
  documents: IDocumentMetadataModel[] | (() => IDocumentMetadataModel[]);
  stores: IDocumentGroupStores;
}

interface IBuildDocumentCollectionProps {
  docMap: Map<string, IDocumentMetadataModel[]>;
  sortedSectionLabels: string[];
  sortType: SecondarySortType;
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
 * - Problems
 *
 * Its main purpose is to provide sub sorting options for documents that are already
 * sorted by a primary sort filter.
 *
 */
export class DocumentGroup {
  stores: IDocumentGroupStores;
  label: string;
  sortType: SortType;
  icon?: FC<SVGProps<SVGSVGElement>>;
  /**
   * Concrete list of documents owned by this group instance.
   *
   * This is set when the `documents` argument passed to the constructor is an
   * array of `IDocumentMetadataModel`. In that case, `documentsFunc` remains
   * undefined and this array is returned by the `documents` getter.
   *
   * At most one of `ownDocuments` or `documentsFunc` is expected to be defined
   * for a given `DocumentGroup` instance.
   */
  private ownDocuments?: IDocumentMetadataModel[];
  /**
   * Lazy document provider for this group instance.
   *
   * This is set when the `documents` argument passed to the constructor is a
   * function returning `IDocumentMetadataModel[]`. In that case,
   * `ownDocuments` remains undefined and the `documents` getter calls this
   * function each time documents are requested so another object can manage
   * and recompute the documents as needed.
   *
   * At most one of `ownDocuments` or `documentsFunc` is expected to be defined
   * for a given `DocumentGroup` instance.
   */
  private documentsFunc?: () => IDocumentMetadataModel[];

  constructor(props: IDocumentGroup) {
    makeAutoObservable(this);
    const { stores, label, sortType, documents, icon } = props;
    this.stores = stores;
    this.label = label;
    this.sortType = sortType;
    if (typeof documents === "function") {
      this.documentsFunc = documents;
    } else {
      this.ownDocuments = documents;
    }
    this.icon = icon;
  }

  get documents(): IDocumentMetadataModel[] {
    return this.documentsFunc ? this.documentsFunc() : this.ownDocuments ?? [];
  }

  buildDocumentCollection(props: IBuildDocumentCollectionProps): DocumentGroup[] {
    const { docMap, sortedSectionLabels, sortType } = props;
    return sortedSectionLabels.map(label => {
      return new DocumentGroup({
        label,
        sortType,
        documents: docMap.get(label) ?? [],
        stores: this.stores
      });
    });
  }

  sortBy(sortType: SecondarySortType): DocumentGroup[] {
    switch (sortType) {
      case "Date":
        return this.byDate;
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
      case "Problem":
        return this.byProblem;
      default:
        return [];
    }
  }

  get byDate(): DocumentGroup[] {
    const docMapWithDates: Map<string, { documents: IDocumentMetadataModel[], date: Date | null }> = new Map();
    this.documents.forEach((doc) => {
      let sectionLabel = "No Date";
      let sectionDate: Date | null = null;

      if (doc.createdAt) {
        const date = new Date(doc.createdAt);
        const dayNum = date.toLocaleString("en-US", { day: "2-digit" });
        const dayName = date.toLocaleString("en-US", { weekday: "long" });
        const monthName = date.toLocaleString("en-US", { month: "short" });
        const year = date.getFullYear();
        sectionLabel = `${dayName}, ${monthName} ${dayNum}, ${year}`;
        sectionDate = date;
      }

      if (!docMapWithDates.has(sectionLabel)) {
        docMapWithDates.set(sectionLabel, { documents: [], date: sectionDate });
      }
      docMapWithDates.get(sectionLabel)?.documents.push(doc);
    });

    const sortedSectionLabels = sortDateSectionLabels(Array.from(docMapWithDates.keys()), docMapWithDates);
    const docMap = new Map<string, IDocumentMetadataModel[]>();
    docMapWithDates.forEach((value, key) => {
      docMap.set(key, value.documents);
    });
    return this.buildDocumentCollection({sortedSectionLabels, sortType: "Date", docMap});
  }

  get byGroup(): DocumentGroup[] {
    const groupLabel = this.stores.appConfig?.getCustomLabel("Group") ?? "Group";
    const docMap = createDocMapByGroups(this.documents, this.stores.groups.groupForUser, groupLabel);
    const sortedSectionLabels = sortGroupSectionLabels(Array.from(docMap.keys()));
    return this.buildDocumentCollection({sortedSectionLabels, sortType: "Group", docMap});
  }

  get byName(): DocumentGroup[] {
    const docMap = createDocMapByNames(this.documents, this.stores.class.getUserById);
    const sortedSectionLabels = sortNameSectionLabels(Array.from(docMap.keys()));
    return this.buildDocumentCollection({sortedSectionLabels, sortType: "Name", docMap});
  }

  get byStrategy(): DocumentGroup[] {
    const commentTags = this.stores.appConfig.commentTags;
    const tagsWithDocs = getTagsWithDocs(this.documents, commentTags);

    const sortedDocsArr: DocumentGroup[] = [];
    Object.entries(tagsWithDocs).forEach((tagKeyAndValObj) => {
      const tagWithDocs = tagKeyAndValObj[1] as TagWithDocs;
      const label = tagWithDocs.tagValue;
      const docKeys = tagWithDocs.docKeysFoundWithTag;
      const documents = this.documents.filter(doc => docKeys.includes(doc.key));
      sortedDocsArr.push(new DocumentGroup({label, sortType: "Strategy", documents, stores: this.stores }));
    });
    return sortedDocsArr;
  }

  get byTools(): DocumentGroup[] {
    const tileTypeToDocumentsMap = createTileTypeToDocumentsMap(this.documents);

    // Map the tile types to their display names
    const sectionedDocuments = Array.from(tileTypeToDocumentsMap.keys()).map(tileType => {
      const section: DocumentGroup = new DocumentGroup({
        label: tileType,
        sortType: "Tools",
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
    return this.buildDocumentCollection({sortedSectionLabels, sortType: "Bookmarked", docMap});
  }

  get byProblem(): DocumentGroup[] {
    const docMap: Map<string, IDocumentMetadataModel[]> = new Map();
    this.documents.forEach((doc) => {
      const investigationOrdinal = doc.investigation;
      const problemOrdinal = doc.problem;
      let sectionLabel = "No Problem";

      if (investigationOrdinal != null && problemOrdinal != null) {
        sectionLabel = `Problem ${investigationOrdinal}.${problemOrdinal}`;
      } else if (problemOrdinal != null) {
        sectionLabel = `Problem ${problemOrdinal}`;
      }

      if (!docMap.has(sectionLabel)) {
        docMap.set(sectionLabel, []);
      }
      docMap.get(sectionLabel)?.push(doc);
    });

    const sortedSectionLabels = sortProblemSectionLabels(Array.from(docMap.keys()));
    return this.buildDocumentCollection({sortedSectionLabels, sortType: "Problem", docMap});
  }
}
