import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { ITileModel } from "../tiles/tile-model";


export function logSharedModelDocEvent(event: LogEventName, modelSource: ITileModel, modelLinkedArr: ITileModel[]) {
  //Create sourceTile obj
  const tileSourceId = modelSource.id;
  const tileSourceType = modelSource.content.type;

  const sourceTile = {
    type: tileSourceType,
    id: tileSourceId,
  };

  //Create sharedTile obj
  const sharedTile = {
    type: modelLinkedArr[0].content.type,
    id: modelLinkedArr[0].id,
  };

  const params = {
    sourceTile,
    sharedTile
  };

  Logger.log(event, params);
}
