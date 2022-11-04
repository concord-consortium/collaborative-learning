import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { TileMetadataModel } from "../../models/tiles/tile-metadata";
import { kDataCardDefaultHeight, kDataCardToolID } from "./data-card-types";
import DataCardToolIcon from "./assets/data-card-tool.svg";
import { DataCardToolComponent } from "./data-card-tile";
import { defaultDataCardContent, DataCardContentModel } from "./data-card-content";

registerTileContentInfo({
  id: kDataCardToolID,
  modelClass: DataCardContentModel,
  titleBase: "Data Card Collection",
  metadataClass: TileMetadataModel,
  defaultContent: defaultDataCardContent,
  defaultHeight: kDataCardDefaultHeight
});

registerTileComponentInfo({
  id: kDataCardToolID,
  Component: DataCardToolComponent,
  tileEltClass: "data-card-tool-tile",
  Icon: DataCardToolIcon
});
