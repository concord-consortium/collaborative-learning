import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { TileMetadataModel } from "../../models/tiles/tile-metadata";
import { kDataCardDefaultHeight, kDataCardTileType } from "./data-card-types";
import DataCardToolIcon from "./assets/data-card-tool.svg";
import { DataCardToolComponent } from "./data-card-tile";
import {
  defaultDataCardContent, DataCardContentModel, updateDataCardContentWithNewSharedModelIds
} from "./data-card-content";

registerTileContentInfo({
  type: kDataCardTileType,
  modelClass: DataCardContentModel,
  titleBase: "Data Card Collection",
  metadataClass: TileMetadataModel,
  defaultContent: defaultDataCardContent,
  defaultHeight: kDataCardDefaultHeight,
  updateContentWithNewSharedModelIds: updateDataCardContentWithNewSharedModelIds
});

registerTileComponentInfo({
  type: kDataCardTileType,
  Component: DataCardToolComponent,
  tileEltClass: "data-card-tool-tile",
  Icon: DataCardToolIcon
});
