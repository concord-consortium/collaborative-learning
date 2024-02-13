

import { LogEventName } from "../../../lib/logger-types";
import { Logger } from "../../../lib/logger";
import { IArrowAnnotation } from "src/models/annotations/arrow-annotation";

//creation
//deletion
//change label/title
//show_hide

// SPARROW_CREATION,
// SPARROW_DELETION,
// SPARROW_TITLE_CHANGE,
// SPARROW_HIDE_SHOW,



//1 log sparrow creation
//1.1 - tile  type for start and end points
//1 - when created log sparrow id.
// 1.1 TODO: we can change the syntax to sparrowSourceType and sparrowTargetType
//but also include the ID of the tile from source and target

function processSparrowEventParams(arrow: IArrowAnnotation, self: any){
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

export function logSparrowCreateOrDelete(event: LogEventName, arrow: IArrowAnnotation, self: any){
  const params = processSparrowEventParams(arrow, self);
  Logger.log(event, params);
}





export function logSparrowHideShow(){
  Logger.log(LogEventName.SPARROW_HIDE_SHOW);
}
