

import { LogEventName } from "../../../lib/logger-types";
import { DocumentModelType } from "../../../../src/models/document/document";
import { SectionModelType } from "../../../../src/models/curriculum/section";
import { logDocumentEvent } from "../../../../src/models/document/log-document-event";
import { logSectionEvent } from "../../../../src/models/document/log-section-event";
import { Logger } from "../../../lib/logger";

export interface IToolbarEventProps {
  document?: DocumentModelType;
  section?: SectionModelType;
  targetDocument?: DocumentModelType;
}

export function logToolbarEvent(
  event: LogEventName, toolbarProps: IToolbarEventProps, otherParams: Record<string, any> = {}
) {
  const { document, section, targetDocument } = toolbarProps;
  if (document) {
    logDocumentEvent(event, {document, targetDocument}, undefined, otherParams);
  } else if (section) {
    logSectionEvent(event, {section, targetDocument}, undefined, otherParams);
  } else {
    Logger.log(event, otherParams);
  }
}
