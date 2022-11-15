import { Logger } from "../../../lib/logger";
import { DocumentModelType } from "../../document/document";
import { kLogDocumentEvent } from "../../document/log-document-event";

export const kLogTileBaseEvent = "LogTileBaseEvent";

interface IParams extends Record<string, any> {
  document: DocumentModelType;
  tileId: string;
}

Logger.registerEventType(kLogTileBaseEvent, (_params) => {
  const { document, tileId, ...others } = _params as IParams;
  const sectionId = document?.content?.getSectionIdForTile(tileId);
  return { nextEventType: kLogDocumentEvent, document, tileId, sectionId, ...others };
});
