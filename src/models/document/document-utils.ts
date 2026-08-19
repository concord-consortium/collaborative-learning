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
import { getCurriculumLabel, isInClassUnitContainer } from "./document-axes";
import { getDocumentKindLabel, getDocumentTitle } from "./document-kinds";
import { getDocumentIdentityParams } from "./log-document-event";
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
  const problemModel = getProblemFromDoc(currentUnit, document);
  if (problemModel) {
    if (isPlanningType(document.type)) {
      return `${problemModel.title}: Planning`;
    }
    return problemModel.title;
  }

  const upperType = upperFirst(document.type);
  const curriculumLabel = getCurriculumLabel(document);
  if (!curriculumLabel) {
    return `${upperType} doc without ${translate("contentLevel.unit")}`;
  }
  return `${upperType} doc from ${curriculumLabel}`;
}

/**
 * A stand-in title for a document that stores none and whose kind resolves no title (see
 * getDocumentTitle). The kind names what the document is; the curriculum position says where it came
 * from, read from the stored fields because an unresolvable kind gives no indication of where the
 * document sits.
 */
function getUnresolvedDocumentTitle(document: DocumentModelType | IDocumentMetadataModel) {
  const kindLabel = getDocumentKindLabel(document.kind);
  if (!kindLabel) return undefined;
  const curriculumLabel = getCurriculumLabel(document);
  return curriculumLabel ? `${kindLabel} (${curriculumLabel})` : kindLabel;
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
  // Titles resolvable by kind (class-wide slot titles, the group-document label) come from the registry.
  const kindTitle = getDocumentTitle(document);
  if (kindTitle != null) return kindTitle;

  const { type } = document;
  if (isSupportType(type)) {
    return document.getProperty("caption") || "Support";
  } else if (isProblemType(type) || isPlanningType(type)) {
    return getDocumentTitleFromProblem(unit, document);
  } else {
    const storedTitle = getDocumentTitleWithTimestamp(document, appConfig);
    if (storedTitle) return storedTitle;
    return getUnresolvedDocumentTitle(document) ?? storedTitle;
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
 * Identifies a document's content for logging: the canonical identity fields for a saved document,
 * or `curriculum` (the section path) for curriculum section content. Pass the result to
 * `logDocumentOrCurriculumEvent`, which expands the section path into its facet/section fields and
 * passes the already-named document fields through.
 *
 * This carries identity only. An event that reports on the document's *content* should pass
 * `{ document }` instead, so `logDocumentEvent` can add the properties/visibility/history fields.
 */
export function getDocumentLogParams(content?: DocumentContentModelType): Record<string, any> {
  if (!content) return {};
  const parent = getParent(content);
  return Object.hasOwn(parent, "key")
          ? getDocumentIdentityParams(parent as DocumentModelType)
          : { curriculum: getSectionPath(parent as SectionModelType) };
}

interface IIsDocumentAccessibleToUserParams {
  document?: DocumentModelType;
  documentMetadata?: IDocumentMetadataBase;
  documents: IExemplarVisibilityProvider;
  user: UserModelType;
}
export function isDocumentAccessibleToUser ({
  document, documentMetadata, documents, user
}: IIsDocumentAccessibleToUserParams): boolean {
  const metadata = documentMetadata ?? document?.metadata;
  if (!metadata) return false;

  // If the firestore metadata has a defined visibility, use it. It's prefered because it's reactive to remote changes.
  // However, sometimes its visibility is not defined, in which case use the static loaded document's metadata.
  const visibilityMetadata = documentMetadata?.visibility != null ? documentMetadata : document?.metadata;
  const isShared = visibilityMetadata?.visibility === "public";

  const ownDocument = metadata.uid === user.id;
  const isPublished = isPublishedType(metadata.type);
  const isGroupDoc = metadata.type === GroupDocument; // Group documents are accessible to everyone
  if (user.isTeacherOrResearcher) return true;
  if (user.isStudent) {
    return ownDocument || isShared || isPublished || isGroupDoc
           || (isExemplarType(metadata.type) && documents.isExemplarVisible(metadata.key));
  }
  return false;
}

interface ICanUserEditDocumentParams {
  document?: DocumentModelType;
  documentMetadata?: IDocumentMetadataBase;
  user: UserModelType;
}

/**
 * Whether this user may edit this document — the gate on every Edit button.
 *
 * A published document is a read-only snapshot, not editable by anyone, including its own
 * publisher — publishing copies the document under the publisher's uid, so the ownership check
 * alone can't tell a live document from its published copy. Beyond that exclusion, a user may
 * always edit their own document; otherwise only a `concurrent` (multi-writer) document is
 * editable by someone other than its owner, and then only by someone the document reaches: a class-wide
 * document by any member of its class (teachers included — they belong to the class too), a group
 * document by any member of its group.
 *
 * A researcher gets no edit affordance on anyone else's document, including the concurrent documents
 * of a class or group they observe. The check sits *after* the ownership test on purpose: a researcher
 * still has documents created for them under their own uid, and locking them out of those would serve
 * nothing. Their uid is their own — the portal signs a researcher's JWT for the authenticated user and
 * carries the student being viewed in a separate `target_user_id` claim — so the ownership test can
 * never match a student's document for them.
 *
 * The Firestore metadata is preferred over the loaded document, because it is reactive and arrives
 * first: a groupmate's document is listed before its content finishes loading, and the Edit button
 * appears without a reload. The document is the fallback for the workspace, which opens documents
 * without looking their metadata up. Every field read here is stamped once at creation, so the two
 * sources never disagree — which is why one is chosen outright rather than field by field.
 *
 * This is an example of the `permissions` axis. See the
 * `permissions` section of docs/document-axes/axes.md and "Not covered yet" in
 * docs/document-axes/reading-axes-in-code.md.
 */
export function canUserEditDocument({
  document, documentMetadata, user
}: ICanUserEditDocumentParams): boolean {
  const metadata = documentMetadata ?? document?.metadata;
  if (!metadata) return false;

  const { uid, type, concurrent, context_id: contextId } = metadata;

  if (type && isPublishedType(type)) return false;
  if (!!uid && uid === user.id) return true;
  if (user.isResearcher) return false;
  if (!concurrent) return false;
  // Beyond this point the user must be inside the document's container, asked at the narrowest level the
  // document is kept at. A group document is kept in an offering, so its group is asked first.
  if (isUserInDocumentsGroup(uid, user)) return true;
  if (isInClassUnitContainer(metadata)) {
    return !!contextId && contextId === user.classHash;
  }
  return false;
}

/**
 * Whether the user belongs to the group that owns this document.
 *
 * Compares owners rather than group ids. A group id is unique only within an offering — groups live
 * at `offerings/<offeringId>/groups` — so the same group number in another offering is a different
 * set of students. The owner (`group_<offeringId>_<groupId>`) carries the offering, which makes the
 * comparison exact; Sort Work's "All" filter lists documents from every offering the class has
 * worked through, so documents from another offering do reach this check.
 */
function isUserInDocumentsGroup(uid: string | null | undefined, user: UserModelType): boolean {
  if (!uid || !user.currentGroupId || !user.offeringId) return false;
  return uid === user.userIdForGroupDocuments;
}
