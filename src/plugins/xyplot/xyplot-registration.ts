import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kXYplotDefaultHeight, kXYplotTileType } from "./xyplot-types";
import { XYplotToolComponent } from "./xyplot-tile";
import { defaultXYplotContent, XYplotContentModel } from "./xyplot-content";
import { kGraphTileClass, kGraphTileType } from "./xyplot-defs";
import { createGraphModel, GraphModel } from "./models/graph-model";
import { GraphComponent } from "./components/graph-component";
// import GraphIcon from "./xyplot-icon.svg";
// import { registerV2TileImporter } from "../../v2/codap-v2-tile-importers";
// import { isV2GraphComponent } from "../../v2/codap-v2-types";
import { TileModel } from "../../models/tiles/tile-model";
import { typedId } from "../../utilities/js-utils";
// import { ComponentTitleBar } from "../component-title-bar";
// import { GraphInspector } from "./components/graph-inspector";

import XYplotToolIcon from "./xyplot-icon.svg";

// TODO: Determine what this would be used for in CLUE.
// In CODAP, it's used in registerTileContentInfo.
export const kGraphIdPrefix = "XYPLOT";

registerTileContentInfo({
  defaultContent: () => createGraphModel(),
  defaultHeight: kXYplotDefaultHeight,
  modelClass: XYplotContentModel,
  type: kXYplotTileType,
});

// TODO: Determine if more properties are needed. In CODAP, the
// following additional props are included: TitleBar, defaultHeight, defaultWidth
registerTileComponentInfo({
  Component: XYplotToolComponent,
  Icon: XYplotToolIcon,
  tileEltClass: "xyplot-tool-tile",
  type: kXYplotTileType
});

// TODO: Determine if the below is needed or needs to be modified.
// registerV2TileImporter("DG.GraphView", ({ v2Component, v2Document, sharedModelManager, insertTile }) => {
//   if (!isV2GraphComponent(v2Component)) return;

//   const { title = "", _links_ } = v2Component.componentStorage;
//   const graphTile = TileModel.create({
//     id: typedId(kGraphIdPrefix),
//     title,
//     // TODO: flesh out graph model conversion
//     content: createGraphModel()
//   });
//   insertTile(graphTile);

//   // link shared model
//   const contextId = _links_.context.id;
//   const { data, metadata } = v2Document.getDataAndMetadata(contextId);
//   sharedModelManager?.addTileSharedModel(graphTile.content, data, true);
//   sharedModelManager?.addTileSharedModel(graphTile.content, metadata, true);

//   return graphTile;
// });
