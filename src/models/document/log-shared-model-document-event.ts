

import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
// import { IGraphModel } from "src/plugins/graph/models/graph-model";
// import { IGraphModel } from "../../plugins/graph/models/graph-model";




export function logSharedModelDocEvent(event: LogEventName, modelSource: any, modelLinkedArr: any) {
  //Create sourceTile
  const tileSourceId = modelSource.id;
  const tileSourceType = modelSource.content.type;

  const sourceTile = {
    type: tileSourceType,
    id: tileSourceId,
  };

  //Create linkedTile, iterate through linked models and extract type and id
  const linkedTiles = [];

  for (const modelLinked of modelLinkedArr) {
    linkedTiles.push({
      type: modelLinked.content.type,
      id: modelLinked.id,
    });
  }

  const params = {
    sourceTile,
    linkedTiles
  };

  console.log("eventLogObject:", params);

  Logger.log(event, params);

  console.log("--------------------------------\n");
}
