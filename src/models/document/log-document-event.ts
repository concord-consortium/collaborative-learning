import { IDocumentMetadata } from "../../../shared/shared";
import { Logger } from "../../lib/logger";
import { LogEventMethod, LogEventName } from "../../lib/logger-types";
import { TreeManagerType } from "../history/tree-manager";
import { UserModelType } from "../stores/user";
import { DocumentModelType } from "./document";
import { ExemplarDocument } from "./document-types";
import { IDocumentMetadataModel } from "./document-metadata-model";

interface ITeacherNetworkInfo {
  networkClassHash?: string;
  networkUsername?: string;
}

export interface IDocumentLogEvent extends Record<string, any> {
  document: DocumentModelType | IDocumentMetadata | IDocumentMetadataModel;
  targetDocument?: DocumentModelType | IDocumentMetadata | IDocumentMetadataModel;
}

export function isDocumentLogEvent(params: Record<string, any>): params is IDocumentLogEvent {
  return !!params.document;
}

interface IContext extends Record<string, any> {
  user: UserModelType;
}

export function getAllDocumentProperties(
  document: DocumentModelType | IDocumentMetadata | IDocumentMetadataModel, user?: UserModelType
) {
  // Basic properties
  const basicProps = {
    uid: document.uid,
    key: document.key,
    type: document.type,
    title: document.title || ""
  };
  const isRemote = "isRemote" in document ? document.isRemote : undefined;
  const remoteContext = "remoteContext" in document ? document.remoteContext : undefined;
  const properties = document.properties && typeof document.properties.toJSON === "function"
    ? document.properties.toJSON()
    : {};
  const visibility = "visibility" in document ? document.visibility : undefined;
  const changes = "changeCount" in document ? document.changeCount : undefined;

  // Log the ID of the last history entry for the document.
  // Note that depending whether the call to write a log event is made
  // before or after the actual change to the document, this may be the history
  // entry that was current before the change, or the one that was created by the change.
  // For the first change in a new document, it may be undefined, in which case we
  // use the string "first" instead.
  const historyId = "treeManagerAPI" in document
    ? (document.treeManagerAPI as TreeManagerType)?.latestDocumentHistoryEntry?.id || "first"
    : undefined;

  const teacherNetworkInfo: ITeacherNetworkInfo | undefined = isRemote && user
    ? { networkClassHash: remoteContext,
        networkUsername: `${basicProps.uid}@${user.portal}` }
    : undefined;

  return {
    ...basicProps,
    properties,
    visibility,
    changes,
    historyId,
    isRemote,
    remoteContext,
    teacherNetworkInfo
  };
}

export function setTargetDocumentProperties(
  result: Record<string, any>, targetDocument: DocumentModelType | IDocumentMetadata | IDocumentMetadataModel
) {
  const targetProps = getAllDocumentProperties(targetDocument);
  result.targetDocumentUid = targetProps.uid;
  result.targetDocumentKey = targetProps.key;
  result.targetDocumentType = targetProps.type;
  result.targetDocumentTitle = targetProps.title;
  result.targetDocumentProperties = targetProps.properties;
  result.targetDocumentVisibility = targetProps.visibility;
  result.targetDocumentChanges = targetProps.changes;
  result.targetDocumentHistoryId = targetProps.historyId;

  if (targetProps.teacherNetworkInfo) {
    result.targetDocumentNetworkClassHash = targetProps.teacherNetworkInfo.networkClassHash;
    result.targetDocumentNetworkUsername = targetProps.teacherNetworkInfo.networkUsername;
  }
}

function processDocumentEventParams(params: IDocumentLogEvent, { user }: IContext) {
  const { document, targetDocument, ...others } = params;
  const documentProps = getAllDocumentProperties(document, user);

  const {
    uid: documentUid,
    key: documentKey,
    type: documentType,
    title: documentTitle,
    properties: documentProperties,
    visibility: documentVisibility,
    changes: documentChanges,
    historyId: documentHistoryId,
    teacherNetworkInfo
  } = documentProps;

  const result = {
    documentUid,
    documentKey,
    documentType,
    documentTitle,
    documentProperties,
    documentVisibility,
    documentChanges,
    documentHistoryId,
    ...others,
    ...teacherNetworkInfo
  } as Record<string, any>;

  if (targetDocument) {
    setTargetDocumentProperties(result, targetDocument);
  }
  return result;
}

export function logDocumentEvent(
  event: LogEventName, _params: IDocumentLogEvent, method?: LogEventMethod, otherParams: Record<string, any> = {}
) {
  const params = processDocumentEventParams(_params, Logger.stores);
  Logger.log(event, {...params, ...otherParams}, method);
}

/**
 * Convenience function to log the appropriate type of VIEW_SHOW_*_DOCUMENT event for the document.
 * @param document
 */
export function logDocumentViewEvent(document: DocumentModelType | IDocumentMetadata | IDocumentMetadataModel) {
  const isRemote = "isRemote" in document ? document.isRemote : undefined;
  const event =
    document.type === ExemplarDocument
      ? LogEventName.VIEW_SHOW_EXEMPLAR_DOCUMENT
      : isRemote
        ? LogEventName.VIEW_SHOW_TEACHER_NETWORK_COMPARISON_DOCUMENT
        : LogEventName.VIEW_SHOW_COMPARISON_DOCUMENT;
  logDocumentEvent(event, { document });
}
