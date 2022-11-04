import { registerToolComponentInfo } from "../../models/tiles/tile-component-info";
import { registerToolContentInfo } from "../../models/tiles/tile-content-info";
import { ToolMetadataModel } from "../../models/tiles/tile-metadata";
import { kDataCardDefaultHeight, kDataCardToolID } from "./data-card-types";
import DataCardToolIcon from "./assets/data-card-tool.svg";
import { DataCardToolComponent } from "./data-card-tile";
import { defaultDataCardContent, DataCardContentModel } from "./data-card-content";

registerToolContentInfo({
  id: kDataCardToolID,
  modelClass: DataCardContentModel,
  titleBase: "Data Card Collection",
  metadataClass: ToolMetadataModel,
  defaultContent: defaultDataCardContent,
  defaultHeight: kDataCardDefaultHeight
});

registerToolComponentInfo({
  id: kDataCardToolID,
  Component: DataCardToolComponent,
  toolTileClass: "data-card-tool-tile",
  Icon: DataCardToolIcon
});
