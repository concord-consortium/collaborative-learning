import { getSnapshot } from "mobx-state-tree";
import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { DocumentsModelType } from "../../stores/documents";
import { ITileModel } from "../tile-model";
import { kLogTileBaseEvent } from "./log-tile-base-event";

export const kLogTileDocumentEvent = "LogTileDocumentEvent";

interface IParams extends Record<string, any> {
  tile: ITileModel;
  commentText?: string;
}

interface IContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
}

Logger.registerEventType(kLogTileDocumentEvent, (_params, _context) => {
  const { tile: { id: tileId, content }, ...others } = _params as IParams;
  const tileType = content.type;
  const context = _context as IContext;
  const document = context.documents.findDocumentOfTile(tileId) ||
                    context.networkDocuments.findDocumentOfTile(tileId);
  const legacyTileProps = { objectId: tileId, objectType: tileType, serializedObject: getSnapshot(content) };
  return { nextEventType: kLogTileBaseEvent, document, tileId, tileType, ...legacyTileProps, ...others };
});

export function logTileDocumentEvent(event: LogEventName, params: IParams) {
  Logger.logEvent(kLogTileDocumentEvent, event, params);
}
