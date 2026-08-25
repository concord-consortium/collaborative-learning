import { getSnapshot } from "mobx-state-tree";
import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { IDocumentLookupContext, resolveTileLogContext } from "../../../lib/logger-utils";
import { ITileModel } from "../tile-model";
import { isTileBaseEvent, logTileBaseEvent } from "./log-tile-base-event";

interface ITileDocumentLogEvent extends Record<string, any> {
  tile: ITileModel;
  commentText?: string;
}

function processTileDocumentEventParams(params: ITileDocumentLogEvent, context: IDocumentLookupContext) {
  const { tile: { id: tileId, content }, ...others } = params;
  const tileType = content.type;
  const { document, tileTitle } = resolveTileLogContext({ tileId }, context);
  const legacyTileProps = { objectId: tileId, objectType: tileType, serializedObject: getSnapshot(content) };
  return { document, tileId, tileType, ...legacyTileProps, tileTitle, ...others };
}

export function logTileDocumentEvent(event: LogEventName, _params: ITileDocumentLogEvent,
  runBeforeContainerLogging?: () => void) {
  const params = processTileDocumentEventParams(_params, Logger.stores);
  if (isTileBaseEvent(params)) {
    logTileBaseEvent(event, params, runBeforeContainerLogging);
  }
  else {
    Logger.log(event, params);
    if (runBeforeContainerLogging) {
      runBeforeContainerLogging();
    }
  }
}
