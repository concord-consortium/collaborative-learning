import { getParent } from "mobx-state-tree";
import { upperFirst } from "lodash";
import { IDocumentMetadataBase } from "../../../shared/shared";
import { SectionModelType } from "../curriculum/section";
import { getSectionPath, UnitModelType } from "../curriculum/unit";
import { AppConfigModelType } from "../stores/app-config-model";
import { UserModelType } from "../stores/user";
import { DocumentModelType, IExemplarVisibilityProvider } from "./document";
import { DocumentContentModelType } from "./document-content";
import { GroupDocument, isExemplarType, isPlanningType, isProblemType,
  isPublishedType, isSupportType } from "./document-types";
import { IDocumentMetadataModel } from "../document/document-metadata-model";
import { getLocalTimeStamp } from "../../utilities/time";

function getProblemFromDoc(unit: UnitModelType, document: DocumentModelType | IDocumentMetadataModel) {
  if (unit.code !== document.unit) {
    return undefined;
  }
  const investigation = unit.getInvestigation(Number(document.investigation));
  const problem = investigation?.getProblem(Number(document.problem));
  return problem;
}

function getDocumentTitleFromProblem(currentUnit: UnitModelType, document: DocumentModelType | IDocumentMetadataModel) {
  const {type, unit, investigation, problem} = document;
  const problemModel = getProblemFromDoc(currentUnit, document);
  if (problemModel) {
    if (isPlanningType(type)) {
      return `${problemModel.title}: Planning`;
    }
    return problemModel.title;
  }

  const upperType = upperFirst(document.type);
  if (!unit) {
    return `${upperType} doc without unit`;
  }
  return `${upperType} doc from ${unit}-${investigation}.${problem}`;
}

export function getDocumentTitleWithTimestamp(
  document: DocumentModelType | IDocumentMetadataModel,
  appConfig: AppConfigModelType
) {
  const timeStampPropName = appConfig.docTimeStampPropertyName || undefined;
  const timeStampProp = timeStampPropName && document.getProperty(timeStampPropName);
  const timeStamp = timeStampProp
                      ? parseFloat(timeStampProp)
                      : undefined;
  const timeStampStr = timeStamp ? getLocalTimeStamp(timeStamp) : undefined;
  return timeStampStr
          ? `${document.title} (${timeStampStr})`
          : document.title;
}

export function getDocumentDisplayTitle(
  unit: UnitModelType,
  document: DocumentModelType | IDocumentMetadataModel,
  appConfig: AppConfigModelType
) {
  const { type } = document;
  if (isSupportType(type)) {
    return document.getProperty("caption") || "Support";
  } else if (isProblemType(type) || isPlanningType(type)) {
    return getDocumentTitleFromProblem(unit, document);
  } else {
    return getDocumentTitleWithTimestamp(document, appConfig);
  }
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

// TODO: handle the visibility of group documents. The request in upcoming work is for group documents
// to be visible to everyone in the class by default. So either we just say anything that is a group
// document is visible to everyone in the class. Or we set the visibility property on group documents
// to "public" when they are created.
export const isDocumentAccessibleToUser = (
  doc: IDocumentMetadataBase, user: UserModelType, documentStore: IExemplarVisibilityProvider
) => {
  const ownDocument = doc.uid === user.id;
  const ownGroupDocument = doc.type === GroupDocument && doc.groupId && user.currentGroupId === doc.groupId;
  const isShared = doc.visibility === "public";
  const isPublished = isPublishedType(doc.type);
  if (user.isTeacherOrResearcher) return true;
  if (user.isStudent) {
    return ownDocument || ownGroupDocument || isShared || isPublished
           || (isExemplarType(doc.type) && documentStore.isExemplarVisible(doc.key));
  }
  return false;
};
