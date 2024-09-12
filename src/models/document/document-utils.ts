import { getParent } from "mobx-state-tree";
import { IDocumentMetadata } from "../../../shared/shared";
import { ProblemModelType } from "../curriculum/problem";
import { SectionModelType } from "../curriculum/section";
import { getSectionPath } from "../curriculum/unit";
import { AppConfigModelType } from "../stores/app-config-model";
import { UserModelType } from "../stores/user";
import { DocumentModelType, IExemplarVisibilityProvider } from "./document";
import { DocumentContentModelType } from "./document-content";
import { isExemplarType, isPlanningType, isProblemType, isPublishedType } from "./document-types";

export function getDocumentDisplayTitle(
  document: DocumentModelType, appConfig: AppConfigModelType, problem?: ProblemModelType,
  unit?: string
) {
  const { type } = document;
  const documentProblemOrdinal = `${document.investigation}.${document.problem}`;
  const problemTitle = !(document.problem || document.investigation || document.unit) ||
                       (documentProblemOrdinal === String(problem?.ordinal) && unit === document?.unit)
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

export const isDocumentAccessibleToUser = (
  doc: IDocumentMetadata, user: UserModelType, documentStore: IExemplarVisibilityProvider
) => {
  const ownDocument = doc.uid === user.id;
  const isShared = doc.visibility === "public";
  const isPublished = isPublishedType(doc.type);
  if (user.type === "teacher") return true;
  if (user.type === "student") {
    return ownDocument || isShared || isPublished
           || (isExemplarType(doc.type) && documentStore.isExemplarVisible(doc.key));
  }
  return false;
};
