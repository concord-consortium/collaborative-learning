import { getParent } from "mobx-state-tree";
import { ProblemModelType } from "../curriculum/problem";
import { SectionModelType } from "../curriculum/section";
import { getSectionPath } from "../curriculum/unit";
import { AppConfigModelType } from "../stores/app-config-model";
import { DocumentModelType } from "./document";
import { DocumentContentModelType } from "./document-content";
import { isPlanningType, isProblemType } from "./document-types";

export function getDocumentDisplayTitle(
  document: DocumentModelType, appConfig: AppConfigModelType, problem?: ProblemModelType,
  unit?: string
) {
  const { type } = document;
  const problemTitle = !(document.problemOrdinal || document.unit) ||
                       (document.problemOrdinal === String(problem?.ordinal) && unit === document?.unit)
    ? problem?.title || "Unknown Problem"
    : "Unknown Problem";
  return document.isSupport
    ? document.getProperty("caption") || "Support"
    : isProblemType(type)
        ? problemTitle
        : isPlanningType(type)
            ? `${problem?.title || "Unkown"}: Planning`
            : document.getDisplayTitle(appConfig);
}

/**
 * Returns the key for user documents or path for problem documents
 * @param document
 * @returns
 */
export function getDocumentIdentifier(document?: DocumentContentModelType) {
  if (!document) {
    return undefined;
  }

  const parent = getParent(document);
  if (Object.hasOwn(parent, "key")) {
    return (parent as DocumentModelType).key;
  } else {
    const section = parent as SectionModelType;
    return getSectionPath(section);
  }
}
