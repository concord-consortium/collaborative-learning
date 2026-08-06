import { IDocumentMetadata } from "../../shared/shared";
import { FC, SVGProps } from "react";
import { Bookmarks } from "src/models/stores/bookmarks";
import { getTileComponentInfo } from "../models/tiles/tile-component-info";
import { IDocumentMetadataModel } from "../models/document/document-metadata-model";
import { DocumentGroup } from "../models/stores/document-group";
import { upperWords } from "./string-utils";
import { translate } from "./translation/translate";

import SparrowHeaderIcon from "../assets/icons/sort-by-tools/sparrow-id.svg";

export type DocumentCollection = {
  label: string;
  documents: IDocumentMetadata[];
  icon?: React.FC<React.SVGProps<SVGSVGElement>>; //exists only in the "sort by tools" case
}

type TagWithDocs = {
  tagKey: string;
  tagValue: string;
  docKeysFoundWithTag: string[];
};

export const sortDateSectionLabels = (
  docMapKeys: string[], documentMap: Map<string, { documents: IDocumentMetadataModel[], date: Date | null }>
) => {
  return docMapKeys.sort((a, b) => {
    if (a === "No Date") return 1;
    if (b === "No Date") return -1;

    const dateA = documentMap.get(a)?.date;
    const dateB = documentMap.get(b)?.date;

    if (dateA && dateB) {
      return dateB.getTime() - dateA.getTime();
    }

    // This should not be reached because all non-"No Date" labels have valid dates.
    // If it is reached due to unexpected data, keep the existing order.
    return 0;
  });
};

/** Section label for documents that belong to the class as a whole rather than to a group. */
export const kWholeClassSectionLabel = "Whole Class";

/** Section label, in the "by name" sort, for documents that have no personal author. */
export const kNoNameSectionLabel = "No Name";

/**
 * The ordering information for one "by name" section, carried alongside the label for the same reason
 * as GroupSectionSortKey below: only the student sections are names, and the rest must not be sorted as
 * if they were. Named students come first, then group documents from other assignments, then the
 * authorless section — the same shape as the "by group" sort, which ends with its own catch-all.
 */
export type NameSectionSortKey =
  | { section: "student" }
  | { section: "otherAssignment" }
  | { section: "noName" };

const kNameSectionOrder: Record<NameSectionSortKey["section"], number> = {
  student: 0,
  otherAssignment: 1,
  noName: 2,
};

/**
 * The ordering information for one "by group" section. Carried alongside the section label so the
 * comparator never has to recover structure from the display text, which is translatable
 * (`studentGroup` is overridable per unit) and has no number at all for some sections.
 */
export type GroupSectionSortKey =
  | { section: "class" }
  | { section: "group"; groupId: string }
  | { section: "none" };

const kGroupSectionOrder: Record<GroupSectionSortKey["section"], number> = {
  class: 0,
  group: 1,
  none: 2,
};

const kNumericGroupId = /^\d+$/;

/**
 * Order "by group" sections: the whole class first, then groups by ascending numeric id, then the
 * no-group section. A section with no sort key is ordered as if it had none.
 */
export const sortGroupSections = (docMapKeys: string[], sortKeys: Map<string, GroupSectionSortKey>) => {
  const keyFor = (label: string): GroupSectionSortKey => sortKeys.get(label) ?? { section: "none" };
  return docMapKeys.sort((a, b) => {
    const keyA = keyFor(a);
    const keyB = keyFor(b);
    if (keyA.section !== keyB.section) {
      return kGroupSectionOrder[keyA.section] - kGroupSectionOrder[keyB.section];
    }
    if (keyA.section === "group" && keyB.section === "group") {
      // A group id is usually a number, but not always: under
      // `autoAssignStudentsToIndividualGroups` the group id is the user id, which in demo mode can be
      // a nanoid. Only an all-digit id sorts numerically; the rest sort after those, by label. The
      // check has to be the whole string — a leading-digit one would read a nanoid like "3xK9…" as
      // group 3 and tie it with the real group 3.
      const numA = kNumericGroupId.test(keyA.groupId) ? Number(keyA.groupId) : NaN;
      const numB = kNumericGroupId.test(keyB.groupId) ? Number(keyB.groupId) : NaN;
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return keyA.groupId.localeCompare(keyB.groupId);
    }
    return a.localeCompare(b);
  });
};

export const sortNameSectionLabels = (docMapKeys: string[], sortKeys?: Map<string, NameSectionSortKey>) => {
  const keyFor = (label: string): NameSectionSortKey => sortKeys?.get(label) ?? { section: "student" };
  return docMapKeys.sort((a, b) => {
    const sectionA = keyFor(a).section;
    const sectionB = keyFor(b).section;
    if (sectionA !== sectionB) {
      return kNameSectionOrder[sectionA] - kNameSectionOrder[sectionB];
    }
    // Only the student sections hold names; the others are compared as plain labels.
    if (sectionA !== "student") {
      return a.localeCompare(b);
    }
    const parseName = (name: string) => {
      const [lastName, firstName] = name.split(", ").map(part => part.trim());
      return { firstName, lastName };
    };
    const aParsed = parseName(a);
    const bParsed = parseName(b);

    // Compare by last name, then by first name if last names are equal
    const lastNameCompare = aParsed.lastName.localeCompare(bParsed.lastName);
    if (lastNameCompare !== 0) {
      return lastNameCompare;
    }
    // "Unknown" has no comma, so it has no first name to compare.
    return (aParsed.firstName ?? "").localeCompare(bParsed.firstName ?? "");
  });
};

export const getTagsWithDocs = (
  documents: IDocumentMetadataModel[],
  commentTags: Record<string, string>|undefined,
) => {
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

  // Sort documents into their groups. Also create a group for any strategy found on a document
  // that isn't in the tag map (e.g. a teacher's custom tag from a different unit when sorting by
  // tag across the whole unit), using the raw id as its label, so no tagged document is orphaned
  // from the tag sort.
  documents.forEach(doc => {
    doc.strategies?.forEach(strategy => {
      if (!strategy) return;
      if (!tagsWithDocs[strategy]) {
        tagsWithDocs[strategy] = { tagKey: strategy, tagValue: strategy, docKeysFoundWithTag: [] };
      }
      tagsWithDocs[strategy].docKeysFoundWithTag.push(doc.key);
      uniqueDocKeysWithTags.add(doc.key);
    });
  });

  documents.forEach(doc => {
    if (!uniqueDocKeysWithTags.has(doc.key)) {
      // This document has no comments
      if (tagsWithDocs[""]) {
        tagsWithDocs[""].docKeysFoundWithTag.push(doc.key);
      }
    }
  });
  return tagsWithDocs;
};

export const createTileTypeToDocumentsMap = (documents: IDocumentMetadataModel[], noToolsTerm = "No Tools") => {
  const toolToDocumentsMap = new Map<string, Record<string, any>>();
  const addDocByType = (docToAdd: IDocumentMetadataModel, type: string) => {
    if (!toolToDocumentsMap.get(type)) {
      let icon: FC<SVGProps<SVGSVGElement>> | undefined;
      if (type === "Sparrow") {
        icon = SparrowHeaderIcon;
      } else {
        const componentInfo = getTileComponentInfo(type);
        icon = componentInfo?.HeaderIcon;
      }
      toolToDocumentsMap.set(type, {
          icon,
          documents: []
        }
      );
    }
    toolToDocumentsMap.get(type)?.documents.push(docToAdd);
  };

  //Iterate through all documents, determine if they are valid,
  //create a map of valid ones, otherwise put them into the noToolsTerm section
  documents.forEach((doc) => {
      if (doc.tools) {
        const validTileTypes = doc.tools.filter(type => type !== "Placeholder" && type !== "Unknown");
        if (validTileTypes.length > 0) {
          validTileTypes.forEach(tool => {
            addDocByType(doc, tool);
          });
        } else {
          addDocByType(doc, noToolsTerm);
        }
      }
  });

  return toolToDocumentsMap;
};

export const createDocMapByBookmarks = (
  documents: IDocumentMetadataModel[],
  bookmarks: Bookmarks,
  bookmarkedTerm = "Bookmarked",
  notBookmarkedTerm = "Not Bookmarked"
) => {
  const documentMap: Map<string, IDocumentMetadataModel[]> = new Map();
  documents.forEach((doc) => {
    const sectionLabel = bookmarks.isDocumentBookmarked(doc.key) ? bookmarkedTerm : notBookmarkedTerm;
    if (!documentMap.has(sectionLabel)) {
      documentMap.set(sectionLabel, []);
    }
    documentMap.get(sectionLabel)?.push(doc);
  });
  return documentMap;
};

export const sortProblemSectionLabels = (docMapKeys: string[]) => {
  const problemTerm = upperWords(translate("contentLevel.problem"));
  const noProblemLabel = `No ${problemTerm}`;

  return docMapKeys.sort((a, b) => {
    // "No Problem" goes to the end
    if (a === noProblemLabel) return 1;
    if (b === noProblemLabel) return -1;

    // Parse "Problem X.Y" or "Problem Y" format
    const parseLabel = (label: string) => {
      const regex = new RegExp(`${problemTerm} (?:(\\d+)\\.)?(\\d+)`);
      const match = label.match(regex);
      if (match) {
        return {
          investigation: match[1] ? parseInt(match[1], 10) : 0,
          problem: parseInt(match[2], 10)
        };
      }
      return { investigation: 0, problem: 0 };
    };

    const aVals = parseLabel(a);
    const bVals = parseLabel(b);

    // Sort by investigation first, then by problem
    if (aVals.investigation !== bVals.investigation) {
      return aVals.investigation - bVals.investigation;
    }
    return aVals.problem - bVals.problem;
  });
};

export const sortDocumentsInGroup = (documentGroup: DocumentGroup) => {
  const documents = [...documentGroup.documents];

  // When grouped by date, documents within each date group should be ordered by createdAt
  // in descending order (newest first, oldest last)
  if (documentGroup.sortType === "Date") {
    documents.sort((a, b) => {
      const aTime = a.createdAt ?? 0;
      const bTime = b.createdAt ?? 0;
      return bTime - aTime;
    });
  }

  return documents;
};
