import {
  DataflowContentModel, defaultDataflowContent, kDataflowDefaultHeight, kDataflowToolID
} from "./model/dataflow-content";
import { registerToolComponentInfo } from "../../models/tools/tool-component-info";
import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { ToolMetadataModel } from "../../models/tools/tool-metadata";
import DataflowToolComponent from "./components/dataflow-tool";
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
