import { registerToolComponentInfo } from "../tile-component-info";
import { registerToolContentInfo } from "../tile-content-info";
import {
  kTableToolID, TableContentModel, TableMetadataModel, kTableDefaultHeight, defaultTableContent
} from "./table-content";
import TableToolComponent from "../../../components/tiles/table/table-tile";
import TableToolIcon from "../../../clue/assets/icons/table-tool.svg";

registerToolContentInfo({
  id: kTableToolID,
  titleBase: "Table",
  modelClass: TableContentModel,
  metadataClass: TableMetadataModel,
  defaultHeight: kTableDefaultHeight,
  defaultContent: defaultTableContent
});

registerToolComponentInfo({
  id: kTableToolID,
  Component: TableToolComponent,
  toolTileClass: "table-tool-tile",
  Icon: TableToolIcon
});
