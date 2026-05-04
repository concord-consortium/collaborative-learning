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
import { GroupDocument, isExemplarType, isPlanningType, isProblemType,
  isPublishedType, isSupportType } from "./document-types";

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

/**
 * True when `doc` is a group document and `user` is currently in that group.
 * Group documents use a synthetic uid (`group_<offering>_<group>`) rather than
 * any real user's id, so `doc.uid === user.id` never holds for them; group
 * membership is the right authorization check.
 */
export function isOwnGroupDocument(
  doc: Pick<IDocumentMetadataBase, "type" | "groupId">,
  user: UserModelType
): boolean {
  return doc.type === GroupDocument && !!doc.groupId && user.currentGroupId === doc.groupId;
}

// TODO: handle the visibility of group documents — see CLUE-380 ("Group documents autoshared").
// Group docs should be visible to everyone in the class by default. Either treat any group document
// as class-visible here, or set visibility to "public" when group docs are created.
export function isDocumentAccessibleToUser(
  doc: IDocumentMetadataBase, user: UserModelType, documentStore: IExemplarVisibilityProvider
): boolean {
  const ownDocument = doc.uid === user.id;
  const ownGroupDocument = isOwnGroupDocument(doc, user);
  const isShared = doc.visibility === "public";
  const isPublished = isPublishedType(doc.type);
  if (user.isTeacherOrResearcher) return true;
  if (user.isStudent) {
    return ownDocument || ownGroupDocument || isShared || isPublished
           || (isExemplarType(doc.type) && documentStore.isExemplarVisible(doc.key));
  }
  return false;
}
