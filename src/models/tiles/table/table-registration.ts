import { updateTableContentWithNewSharedModelIds, updateTableObjectWithNewSharedModelIds } from "./table-utils";
import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import {
  kTableTileType, TableContentModel, TableMetadataModel, kTableDefaultHeight, defaultTableContent
} from "./table-content";
import TableToolComponent from "../../../components/tiles/table/table-tile";

import Icon from "../../../clue/assets/icons/table-tool.svg";
import HeaderIcon from "../../../assets/icons/sort-by-tools/table-tile-id.svg";

export function tileSnapshotPreProcessor(tileSnap: any) {
  // Get the title from the dataSet if it's only there
  return !("title" in tileSnap) && "name" in tileSnap.content
    ? { ...tileSnap, title: tileSnap.content.name }
    : tileSnap;
}

registerTileContentInfo({
  type: kTableTileType,
  displayName: "Table",
  titleBase: "Table Data",
  useContentTitle: true,
  modelClass: TableContentModel,
  metadataClass: TableMetadataModel,
  defaultHeight: kTableDefaultHeight,
  defaultContent: defaultTableContent,
  tileSnapshotPreProcessor,
  updateContentWithNewSharedModelIds: updateTableContentWithNewSharedModelIds,
  updateObjectReferenceWithNewSharedModelIds: updateTableObjectWithNewSharedModelIds,
  isDataProvider: true,
  isDataConsumer: true
});

registerTileComponentInfo({
  type: kTableTileType,
  Component: TableToolComponent,
  tileEltClass: "table-tool-tile",
  Icon,
  HeaderIcon,
  // The table handles its own tile-selection on pointerdown (see table-tile.tsx).
  // The default tile-component handler treats shift-click on an already-selected
  // tile as a deselect, which conflicts with the row-label cell's shift-click
  // gesture (toggle row in/out of multi-row selection) and disables the focus
  // trap mid-gesture.
  tileHandlesOwnSelection: true,
});
