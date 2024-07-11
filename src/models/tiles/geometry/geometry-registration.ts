import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { GeometryContentModel, GeometryMetadataModel, defaultGeometryContent } from "./geometry-content";
import { kGeometryTileType } from "./geometry-types";
import { kGeometryDefaultHeight } from "./jxg-types";
import GeometryToolComponent from "../../../components/tiles/geometry/geometry-tile";
import { updateGeometryContentWithNewSharedModelIds, updateGeometryObjectWithNewSharedModelIds }
  from "./geometry-utils";

import Icon from "../../../clue/assets/icons/geometry-tool.svg";
import HeaderIcon from "../../../assets/icons/sort-by-tools/shapes-graph-tile-id.svg";

export function tileSnapshotPreProcessor(tileSnap: any) {
  // Move the title up to handle legacy geometry tiles
  return !("title" in tileSnap) && "title" in tileSnap.content
    ? { ...tileSnap, title: tileSnap.content.title }
    : tileSnap;
}

registerTileContentInfo({
  type: kGeometryTileType,
  displayName: "Shapes Graph",
  modelClass: GeometryContentModel,
  metadataClass: GeometryMetadataModel,
  defaultHeight: kGeometryDefaultHeight,
  exportNonDefaultHeight: true,
  isDataConsumer: true,
  consumesMultipleDataSets: () => true,
  defaultContent: defaultGeometryContent,
  tileSnapshotPreProcessor,
  updateContentWithNewSharedModelIds: updateGeometryContentWithNewSharedModelIds,
  updateObjectReferenceWithNewSharedModelIds: updateGeometryObjectWithNewSharedModelIds
});

registerTileComponentInfo({
  type: kGeometryTileType,
  Component: GeometryToolComponent,
  tileEltClass: "geometry-tool-tile",
  tileHandlesOwnSelection: true,
  Icon,
  HeaderIcon
});
