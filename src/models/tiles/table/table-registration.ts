import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import {
  kTableToolID, TableContentModel, TableMetadataModel, kTableDefaultHeight, defaultTableContent
} from "./table-content";
import TableToolComponent from "../../../components/tiles/table/table-tile";
import TableToolIcon from "../../../clue/assets/icons/table-tool.svg";

registerTileContentInfo({
  id: kTableToolID,
  titleBase: "Table",
  modelClass: TableContentModel,
  metadataClass: TableMetadataModel,
  defaultHeight: kTableDefaultHeight,
  defaultContent: defaultTableContent
});

registerTileComponentInfo({
  id: kTableToolID,
  Component: TableToolComponent,
  tileEltClass: "table-tool-tile",
  Icon: TableToolIcon
});
