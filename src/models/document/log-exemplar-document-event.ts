import { Logger } from "../../lib/logger";
import { LogEventMethod, LogEventName } from "../../lib/logger-types";
import { IDocumentLogEvent } from "./log-document-event";

// Events that have to do with making Exemplar documents visible, or invisible, to users.

export interface IExemplarDocumentLogEvent extends IDocumentLogEvent {
  // True if after this change the exemplar is visible to the user
  visibleToUser: boolean,
  // What caused the change?  Manual action, or a rule in the system.
  // In the future we might have other options, eg AI
  changeSource: "rule" | "manual",
  // If the change was based on a rule, this is the name of the rule.
  rule?: string
}

export function logExemplarDocumentEvent (event: LogEventName.EXEMPLAR_VISIBILITY_UPDATE,
    params: IExemplarDocumentLogEvent, method?: LogEventMethod) {
  Logger.log(event, params, method);
}
