

import { LogEventName } from "../../../lib/logger-types";
import { Logger } from "../../../lib/logger";
import { IArrowAnnotation } from "../../../../src/models/annotations/arrow-annotation";


function processSparrowEventParams(arrow: IArrowAnnotation, self: any) {
  const sourceTileId = arrow.sourceObject?.tileId;
  const sourceTileModel = self.tileMap.get(sourceTileId);
  const sourceTileType = sourceTileModel ? sourceTileModel.content.type : undefined;

  const targetTileId = arrow.targetObject?.tileId;
  const targetTileModel = self.tileMap.get(targetTileId);
  const targetTileType = targetTileModel ? targetTileModel.content.type : undefined;

  return {
    arrowId: arrow.id,
    sourceTileId,
    sourceTileType,
    targetTileId,
    targetTileType
  };
}

export function logSparrowCreate(event: LogEventName, arrow: IArrowAnnotation, self: any) {
  const params = processSparrowEventParams(arrow, self);
  Logger.log(event, params);
}

export function logSparrowDelete(event: LogEventName, annotationId: string) {
  const params = { arrowId: annotationId };
  Logger.log(event, params);
}

export function logSparrowShowHide(event: LogEventName, showOrHide: string) {
  Logger.log(event, { showOrHide });
}

export function logSparrowTitleChange(event: LogEventName, arrowId: string, newTitle: string){
  const params = { arrowId, newTitle };
  Logger.log(event, params);
}
