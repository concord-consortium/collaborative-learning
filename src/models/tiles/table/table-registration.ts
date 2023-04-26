import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import {
  kTableTileType, TableContentModel, TableMetadataModel, kTableDefaultHeight, defaultTableContent,
  updateTableContentWithNewSharedModelIds
} from "./table-content";
import TableToolComponent from "../../../components/tiles/table/table-tile";
import TableToolIcon from "../../../clue/assets/icons/table-tool.svg";

registerTileContentInfo({
  type: kTableTileType,
  titleBase: "Table",
  modelClass: TableContentModel,
  metadataClass: TableMetadataModel,
  defaultHeight: kTableDefaultHeight,
  defaultContent: defaultTableContent,
  updateContentWithNewSharedModelIds: updateTableContentWithNewSharedModelIds
});

registerTileComponentInfo({
  type: kTableTileType,
  Component: TableToolComponent,
  tileEltClass: "table-tool-tile",
  Icon: TableToolIcon
});
