import {
  DataflowContentModel, defaultDataflowContent, kDataflowDefaultHeight, kDataflowToolID
} from "./model/dataflow-content";
import { registerToolComponentInfo } from "../../models/tiles/tile-component-info";
import { registerToolContentInfo } from "../../models/tiles/tile-content-info";
import { ToolMetadataModel } from "../../models/tiles/tile-metadata";
import DataflowToolComponent from "./components/dataflow-tile";
import DataflowToolIcon from "./assets/program.svg";

registerToolContentInfo({
  id: kDataflowToolID,
  titleBase: "Program",
  modelClass: DataflowContentModel,
  metadataClass: ToolMetadataModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent
});

registerToolComponentInfo({
  id: kDataflowToolID,
  Component: DataflowToolComponent,
  toolTileClass: "dataflow-tool-tile",
  Icon: DataflowToolIcon
});
