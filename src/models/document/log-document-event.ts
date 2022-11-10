import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { UserModelType } from "../stores/user";
import { DocumentModelType } from "./document";

export const kLogDocumentEvent = "LogDocumentEvent";

interface ITeacherNetworkInfo {
  networkClassHash?: string;
  networkUsername?: string;
}

interface IParams extends Record<string, any> {
  document: DocumentModelType;
}

interface IContext extends Record<string, any> {
  user: UserModelType;
}

Logger.registerEventType(kLogDocumentEvent, (_params, _context) => {
  const { document, ...others } = _params as IParams;
  const { user } = _context as IContext;
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
});

export function logDocumentEvent(event: LogEventName, params: IParams) {
  Logger.logEvent(kLogDocumentEvent, event, params);
}
