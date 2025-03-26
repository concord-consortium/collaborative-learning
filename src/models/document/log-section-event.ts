import { IDocumentMetadata } from "../../../shared/shared";
import { Logger } from "../../lib/logger";
import { LogEventMethod, LogEventName } from "../../lib/logger-types";
import { SectionModelType } from "../curriculum/section";
import { IDocumentMetadataModel } from "../stores/sorted-documents";
import { UserModelType } from "../stores/user";
import { DocumentModelType } from "./document";
import { setTargetDocumentProperties } from "./log-document-event";

export interface ISectionLogEvent extends Record<string, any> {
  section: SectionModelType;
  targetDocument?: DocumentModelType | IDocumentMetadata | IDocumentMetadataModel;
}

interface IContext extends Record<string, any> {
  user: UserModelType;
}

function processSectionEventParams(params: ISectionLogEvent) {
  const { section, targetDocument, ...others } = params;

  const result = {
    sectionType: section.type,
    ...others,
  } as Record<string, any>;

  if (targetDocument) {
    setTargetDocumentProperties(result, targetDocument);
  }
  return result;
}

export function logSectionEvent(event: LogEventName, _params: ISectionLogEvent, method?: LogEventMethod) {
  const params = processSectionEventParams(_params);
  Logger.log(event, params, method);
}
