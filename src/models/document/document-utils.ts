import { upperFirst } from "lodash";
import { getParent } from "mobx-state-tree";
import { IDocumentMetadataBase } from "../../../shared/shared";
import { getLocalTimeStamp } from "../../utilities/time";
import { translate } from "../../utilities/translation/translate";
import { SectionModelType } from "../curriculum/section";
import { getSectionPath, UnitModelType } from "../curriculum/unit";
import { IDocumentMetadataModel } from "../document/document-metadata-model";
import { AppConfigModelType } from "../stores/app-config-model";
import { UserModelType } from "../stores/user";
import { DocumentModelType, IExemplarVisibilityProvider } from "./document";
import { DocumentContentModelType } from "./document-content";
import { DrivingQuestionBoardDocument, GroupDocument, isDrivingQuestionBoardType, isExemplarType,
  isPlanningType, isProblemType, isPublishedType, isSupportType } from "./document-types";

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
    return `${upperType} doc without ${translate("contentLevel.unit")}`;
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
  } else if (type === GroupDocument) {
    return `Group ${document.groupId} Document`;
  } else if (isDrivingQuestionBoardType(type)) {
    // Prefer the live authored title so changes in Document Settings take effect
    // immediately, falling back to the title persisted at creation.
    return appConfig.drivingQuestionBoardTitle || document.title || "Driving Question Board";
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

export function isDocumentAccessibleToUser (
  doc: IDocumentMetadataBase, user: UserModelType, documentStore: IExemplarVisibilityProvider
): boolean {
  const ownDocument = doc.uid === user.id;
  const isShared = doc.visibility === "public";
  const isPublished = isPublishedType(doc.type);
  const isGroupDoc = doc.type === GroupDocument; // Group documents are accessible to everyone
  // The class-wide Driving Question Board is accessible to (and editable by) everyone.
  const isDqb = doc.type === DrivingQuestionBoardDocument;
  if (user.isTeacherOrResearcher) return true;
  if (user.isStudent) {
    return ownDocument || isShared || isPublished || isGroupDoc || isDqb
           || (isExemplarType(doc.type) && documentStore.isExemplarVisible(doc.key));
  }
  return false;
}
