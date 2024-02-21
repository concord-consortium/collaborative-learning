
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { SharedModelType } from "../shared/shared-model";
import { ITileModel } from "../tiles/tile-model";


export function logSharedModelDocEvent(event: LogEventName, modelSource: ITileModel,
                                       modelLinkedArr: ITileModel[], sharedModel: SharedModelType) {
  //Create sourceTile obj
  const tileSourceId = modelSource.id;
  const tileSourceType = modelSource.content.type;
  const tileSourceTitle = modelSource.title;

  const sourceTile = {
    type: tileSourceType,
    id: tileSourceId,
    title: tileSourceTitle
  };

  // Create sharedTile objects for all linked models
  const sharedTiles = modelLinkedArr.map(tile => ({
    type: tile.content.type,
    id: tile.id,
    title: tile.title
  }));

  const params = {
    sourceTile,
    sharedTiles,
    sharedModel: { // Log the shared model id and type
      id: sharedModel.id,
      type: sharedModel.type
    }
  };

  Logger.log(event, params);
}
