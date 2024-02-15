

import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { ITileModel } from "../tiles/tile-model";


//TODO:
// • we have to account for when graph unlinks a dataSet via the X button next to its series
// • account for multiple dialogs that are responsible for linking datasets (not just from use-provider-tile-linking)
//   ↳ such as Table's toolbar "Graph-it!" icon

// • Investigate why why modelLinkedArr only has one element, I thought it would would hold more than 1 model,
//   ↳for ex: if Graph linked to two tables, it would have [Table1, Table2] - but this is incorrect

// • When finished, document in ticket that logging occurs for both Graph Tile ("Add Data button")
//   ↳ and Geometry Tile useprovidertileLinking icon


export function logSharedModelDocEvent(event: LogEventName, modelSource: ITileModel, modelLinkedArr: ITileModel[]) {
  //Create sourceTile
  const tileSourceId = modelSource.id;
  const tileSourceType = modelSource.content.type;

  const sourceTile = {
    type: tileSourceType,
    id: tileSourceId,
  };


  //Create sharedTiles paramete, iterate through linked models and extract type and id
  const sharedTiles = [];

  for (const modelLinked of modelLinkedArr) {
    sharedTiles.push({
      type: modelLinked.content.type,
      id: modelLinked.id,
    });
  }



  const params = {
    sourceTile,
    sharedTiles
  };

  Logger.log(event, params);

  console.log("--------------------------------\n");
}
