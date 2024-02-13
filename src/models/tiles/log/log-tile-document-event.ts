import { getSnapshot } from "mobx-state-tree";
import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { getTileTitleForLogging } from "../../../lib/logger-utils";
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
  console.log("➡️ processTileDocumentEventParams");
  console.log("\t🥩 params:", params);
  console.log("\t🥩 context:", context);

  const { tile: { id: tileId, content }, ...others } = params;
  const tileType = content.type;
  const document = context.documents.findDocumentOfTile(tileId) ||
                    context.networkDocuments.findDocumentOfTile(tileId);
  const legacyTileProps = { objectId: tileId, objectType: tileType, serializedObject: getSnapshot(content) };
  const tileTitle = getTileTitleForLogging(tileId, document);
  return { document, tileId, tileType, ...legacyTileProps, tileTitle, ...others };
}

export function logTileDocumentEvent(event: LogEventName, _params: ITileDocumentLogEvent) {
  const params = processTileDocumentEventParams(_params, Logger.stores);
  if (isTileBaseEvent(params)) {
    console.log("base event-------------");
    console.log("event:", event);
    console.log("params:", params);
    logTileBaseEvent(event, params);
  }
  else {

    console.log("📁 log-tile-document-event.ts ------------------------");
    console.log("about to LOG");
    console.log("event:", event);
    console.log("params:", params);

    Logger.log(event, params);
  }
}
