

import { LogEventName } from "../../lib/logger-types";
import { getTileIdFromContent } from "../tiles/tile-model";
// import { IGraphModel } from "src/plugins/graph/models/graph-model";
// import { IGraphModel } from "../../plugins/graph/models/graph-model";



function processSharedModelDocEventParams() {
  return {

  };
}

export function logSharedModelDocEvent(event: LogEventName, model: any, smm: any, dataSetId: string) {
  console.log("📁 log.shared-model-document-event.ts ------------------------");
  console.log("➡️ logSharedModelDocEvent");
  const eventType = (event === 28) ? "Unlink": "Link";

  //determine tile ID and type
  const tileId = getTileIdFromContent(model) ?? "";
  const tileType = model.type;
  console.log("\t⚡ tileId:", tileId); //Graph in our case
  console.log("\t⚡ tileType:", tileType);

  console.log("\t⚡:", eventType);

  console.log("\t⚡dataSetId:", dataSetId);


  const document = smm.document;
  const tileMap = document.tileMap;
  //How to get the tileId

  // const tileIdEvent =
  // const tileTypeEvent = tileMap.get(tileIdEvent).//the tile linked or unlinked

  //determine tileID and type
  console.log("\t with sharedModelManager:", smm);


  const smmMap = smm.sharedModelMap;



  console.log("LOGGER: ", event, "with args:", model);
  // Logger.log(event, params);

  console.log("--------------------------------\n");
}
