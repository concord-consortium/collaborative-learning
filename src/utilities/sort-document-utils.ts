import { IDocumentMetadata } from "../../shared/shared";
import { FC, SVGProps } from "react";
import { Bookmarks } from "src/models/stores/bookmarks";
import { getTileComponentInfo } from "../models/tiles/tile-component-info";
import { IDocumentMetadataModel } from "../models/document/document-metadata-model";

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

export const sortGroupSectionLabels = (docMapKeys: string[]) => {
  return docMapKeys.sort((a, b) => {
    const numA = parseInt(a.replace(/^\D+/g, ''), 10);
    const numB = parseInt(b.replace(/^\D+/g, ''), 10);
    return numA - numB;
  });
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

export const createTileTypeToDocumentsMap = (documents: IDocumentMetadataModel[]) => {
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
  //create a map of valid ones, otherwise put them into the "No Tools" section
  documents.forEach((doc) => {
      if (doc.tools) {
        const validTileTypes = doc.tools.filter(type => type !== "Placeholder" && type !== "Unknown");
        if (validTileTypes.length > 0) {
          validTileTypes.forEach(tool => {
            addDocByType(doc, tool);
          });
        } else {
          addDocByType(doc, "No Tools");
        }
      }
  });

  return toolToDocumentsMap;
};

export const createDocMapByBookmarks = (documents: IDocumentMetadataModel[], bookmarks: Bookmarks) => {
  const documentMap: Map<string, IDocumentMetadataModel[]> = new Map();
  documents.forEach((doc) => {
    const sectionLabel = bookmarks.isDocumentBookmarked(doc.key) ? "Bookmarked" : "Not Bookmarked";
    if (!documentMap.has(sectionLabel)) {
      documentMap.set(sectionLabel, []);
    }
    documentMap.get(sectionLabel)?.push(doc);
  });
  return documentMap;
};
