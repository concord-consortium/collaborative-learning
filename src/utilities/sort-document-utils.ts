import { IDocumentMetadata } from "../../shared/shared";
import { FC, SVGProps } from "react";
import { Bookmarks } from "src/models/stores/bookmarks";
import { getTileComponentInfo } from "../models/tiles/tile-component-info";
import { IDocumentMetadataModel } from "../models/document/document-metadata-model";
import { DocumentGroup } from "../models/stores/document-group";
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

export const createDocMapByGroups = (
  documents: IDocumentMetadataModel[],
  groupForUser: (userId: string) => any,
  groupTerm = "Group"
) => {
  const documentMap: Map<string, IDocumentMetadataModel[]> = new Map();
  documents.forEach((doc) => {
    const userId = doc.uid;
    const group = groupForUser(userId);
    const sectionLabel = group ? `${groupTerm} ${group.id}` : `No ${groupTerm}`;

    if (!documentMap.has(sectionLabel)) {
      documentMap.set(sectionLabel, []);
    }
    documentMap.get(sectionLabel)?.push(doc);
  });
  return documentMap;
};

export const sortGroupSectionLabels = (docMapKeys: string[]) => {
  return docMapKeys.sort((a, b) => {
    const numA = parseInt(a.replace(/^\D+/g, ''), 10);
    const numB = parseInt(b.replace(/^\D+/g, ''), 10);
    return numA - numB;
  });
};

export const createDocMapByNames = (documents: IDocumentMetadataModel[], getUserById: (uid: string) => any) => {
  const documentMap: Map<string, IDocumentMetadataModel[]> = new Map();
  documents.forEach((doc) => {
    const user = getUserById(doc.uid);
    const sectionLabel = user && `${user.lastName}, ${user.firstName}`;
    if (!documentMap.has(sectionLabel)) {
      documentMap.set(sectionLabel, []);
    }
    documentMap.get(sectionLabel)?.push(doc);
  });
  return documentMap;
};

export const sortNameSectionLabels = (docMapKeys: string[]) => {
  return docMapKeys.sort((a, b) => {
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

  // Sort documents into their groups
  documents.forEach(doc => {
    doc.strategies?.forEach(strategy => {
      if (tagsWithDocs[strategy]) {
        tagsWithDocs[strategy].docKeysFoundWithTag.push(doc.key);
        uniqueDocKeysWithTags.add(doc.key);
      }
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
  const problemTerm = translate("Problem");
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
