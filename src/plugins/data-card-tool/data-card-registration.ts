import { registerToolComponentInfo } from "../../models/tools/tool-component-info";
import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { ToolMetadataModel } from "../../models/tools/tool-metadata";
import { kDataCardDefaultHeight, kDataCardToolID } from "./data-card-types";
import DataCardToolIcon from "./assets/data-card-tool.svg";
import { DataCardToolComponent } from "./data-card-tool";
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
