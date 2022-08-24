import { registerToolContentInfo } from "../tool-content-info";
import {
  kTableToolID, TableContentModel, TableMetadataModel, kTableDefaultHeight, defaultTableContent
} from "./table-content";
import TableToolComponent from "../../../components/tools/table-tool/table-tool";
import TableToolIcon from "../../../clue/assets/icons/table-tool.svg";

registerToolContentInfo({
  id: kTableToolID,
  titleBase: "Table",
  modelClass: TableContentModel,
  metadataClass: TableMetadataModel,
  defaultHeight: kTableDefaultHeight,
  defaultContent: defaultTableContent,
  Component: TableToolComponent,
  toolTileClass: "table-tool-tile",
  Icon: TableToolIcon
});
