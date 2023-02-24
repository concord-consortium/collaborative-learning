import { getSnapshot } from "mobx-state-tree";
import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { DocumentsModelType } from "../../stores/documents";
import { ITileModel } from "../tile-model";
import { isTileBaseEvent, logTileBaseEvent } from "./log-tile-base-event";

interface ITileDocumentLogEvent extends Record<string, any> {
  tile: ITileModel;
  commentText?: string;
}

interface IContext extends Record<string, any> {
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
}

function processTileDocumentEventParams(params: ITileDocumentLogEvent, context: IContext) {
  const { tile: { id: tileId, content }, ...others } = params;
  const tileType = content.type;
  const document = context.documents.findDocumentOfTile(tileId) ||
                    context.networkDocuments.findDocumentOfTile(tileId);
  const legacyTileProps = { objectId: tileId, objectType: tileType, serializedObject: getSnapshot(content) };
  const tile = document?.content?.getTile(tileId);
  const tileTitle = tile?.title ?? "<no title>";
  return { document, tileId, tileType, ...legacyTileProps, tileTitle, ...others };
}

export function logTileDocumentEvent(event: LogEventName, _params: ITileDocumentLogEvent) {
  const params = processTileDocumentEventParams(_params, Logger.stores);
  if (isTileBaseEvent(params)) {
    logTileBaseEvent(event, params);
  }
  else {
    Logger.log(event, params);
  }
}
