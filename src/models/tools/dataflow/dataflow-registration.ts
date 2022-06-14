import {
  DataflowContentModel, defaultDataflowContent, kDataflowDefaultHeight, kDataflowToolID
} from "./dataflow-content";
import { registerToolContentInfo } from "../tool-content-info";
import DataflowToolComponent from "../../../components/tools/dataflow/dataflow-tool";
import DataflowToolIcon from "../../../clue/assets/icons/program.svg";

registerToolContentInfo({
  id: kDataflowToolID,
  modelClass: DataflowContentModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent,
  Component: DataflowToolComponent,
  toolTileClass: "dataflow-tool-tile",
  Icon: DataflowToolIcon
});
