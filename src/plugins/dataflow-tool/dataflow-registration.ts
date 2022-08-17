import {
  DataflowContentModel, defaultDataflowContent, kDataflowDefaultHeight, kDataflowToolID
} from "./model/dataflow-content";
import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import DataflowToolComponent from "./components/dataflow-tool";
import DataflowToolIcon from "./assets/program.svg";
import { ToolMetadataModel } from "../../../src/models/tools/tool-types";

registerToolContentInfo({
  id: kDataflowToolID,
  titleBase: "Program",
  modelClass: DataflowContentModel,
  metadataClass: ToolMetadataModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent,
  Component: DataflowToolComponent,
  toolTileClass: "dataflow-tool-tile",
  Icon: DataflowToolIcon
});
