import { Logger } from "../../lib/logger";
import { LogEventMethod, LogEventName } from "../../lib/logger-types";
import { UserModelType } from "../stores/user";
import { DocumentModelType } from "./document";
import { ExemplarDocument } from "./document-types";

interface ITeacherNetworkInfo {
  networkClassHash?: string;
  networkUsername?: string;
}

export interface IDocumentLogEvent extends Record<string, any> {
  document: DocumentModelType;
}

export function isDocumentLogEvent(params: Record<string, any>): params is IDocumentLogEvent {
  return !!params.document;
}

interface IContext extends Record<string, any> {
  user: UserModelType;
}

function processDocumentEventParams(params: IDocumentLogEvent, { user }: IContext) {
  const { document, ...others } = params;
  const teacherNetworkInfo: ITeacherNetworkInfo | undefined = document.isRemote
      ? { networkClassHash: document.remoteContext,
          networkUsername: `${document.uid}@${user.portal}` }
      : undefined;

  return {
    documentUid: document.uid,
    documentKey: document.key,
    documentType: document.type,
    documentTitle: document.title || "",
    documentProperties: document.properties.toJSON(),
    documentVisibility: document.visibility,
    documentChanges: document.changeCount,
    ...others,
    ...teacherNetworkInfo
  };
}

export function logDocumentEvent(event: LogEventName, _params: IDocumentLogEvent, method?: LogEventMethod) {
  const params = processDocumentEventParams(_params, Logger.stores);
  Logger.log(event, params, method);
}

/**
 * Convenience function to log the appropriate type of VIEW_SHOW_*_DOCUMENT event for the document.
 * @param document
 */
export function logDocumentViewEvent(document: DocumentModelType) {
  const event =
    document.type === ExemplarDocument
      ? LogEventName.VIEW_SHOW_EXEMPLAR_DOCUMENT
      : document.isRemote
        ? LogEventName.VIEW_SHOW_TEACHER_NETWORK_COMPARISON_DOCUMENT
        : LogEventName.VIEW_SHOW_COMPARISON_DOCUMENT;
  logDocumentEvent(event, { document });
}
