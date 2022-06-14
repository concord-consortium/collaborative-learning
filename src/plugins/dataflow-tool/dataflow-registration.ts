import {
  DataflowContentModel, defaultDataflowContent, kDataflowDefaultHeight, kDataflowToolID
} from "./model/dataflow-content";
import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import DataflowToolComponent from "./components/dataflow-tool";
import DataflowToolIcon from "../../clue/assets/icons/program.svg";

registerToolContentInfo({
  id: kDataflowToolID,
  modelClass: DataflowContentModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent,
  Component: DataflowToolComponent,
  toolTileClass: "dataflow-tool-tile",
  Icon: DataflowToolIcon
});
