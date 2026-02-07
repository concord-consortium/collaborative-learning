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
  hiddenTitle: true
});
