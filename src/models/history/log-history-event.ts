import { isSectionPath } from "../../../functions/src/shared";
import { LogEventName, Logger } from "../../lib/logger";
import { kLogCurriculumEvent } from "../document/log-curriculum-event";
import { kLogDocumentEvent } from "../document/log-document-event";
import { DocumentsModelType } from "../stores/documents";
import { TreeManagerType } from "./tree-manager";

export const kLogHistoryEvent = "LogHistoryEvent";

type HistoryAction = "showControls" | "hideControls" | "playStart" | "playStop" | "playSeek";
export interface ILogHistory {
  documentId: string;
  historyEventId?: string;  // The id of the history entry where the action took place. Used for start, stop and seek.
  historyIndex?: number; // Index into history array. Used for start, stop, seek.
  historyLength?: number; // Used for start, stop, seek
  action: HistoryAction;
}

interface IContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
}

Logger.registerEventType(kLogHistoryEvent, (params, context) => {
  const { documentId, action, ...others } = params as ILogHistory;
  const { documents, networkDocuments } = context as IContext;

  if (isSectionPath(documentId)) {
    return { nextEventType: kLogCurriculumEvent, curriculum: documentId, ...others };
  }

  const document = documents.getDocument(documentId) || networkDocuments.getDocument(documentId);
  if (document) {
    return { nextEventType: kLogDocumentEvent, document, ...others };
  }

  console.warn("Warning: couldn't transform log history event params for document:", documentId);
  return params;
});

export function logHistoryEvent(historyLogInfo: ILogHistory) {
  const eventMap: Record<HistoryAction, LogEventName> = {
    showControls: LogEventName.HISTORY_SHOW_CONTROLS,
    hideControls: LogEventName.HISTORY_HIDE_CONTROLS,
    playStart: LogEventName.HISTORY_PLAYBACK_START,
    playStop: LogEventName.HISTORY_PLAYBACK_STOP,
    playSeek: LogEventName.HISTORY_PLAYBACK_SEEK
  };
  const event = eventMap[historyLogInfo.action];
  Logger.logEvent(kLogHistoryEvent, event, historyLogInfo);
}

export function logCurrentHistoryEvent(treeManager: TreeManagerType, action: HistoryAction) {
  const { document, mainDocument, numHistoryEventsApplied, currentHistoryEntry } = treeManager;
  const { key: documentId = "" } = mainDocument || {};
  logHistoryEvent({
    documentId,
    historyEventId: currentHistoryEntry?.id,
    historyLength: document.history.length,
    historyIndex: numHistoryEventsApplied ?? 0,
    action
  });
}
