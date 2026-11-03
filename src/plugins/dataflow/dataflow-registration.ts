import {
  DataflowContentModel, defaultDataflowContent, kDataflowDefaultHeight, kDataflowTileType
} from "./model/dataflow-content";
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { registerHistoryBridge } from "../../models/history/history-bridges";
import { TileMetadataModel } from "../../models/tiles/tile-metadata";
import DataflowToolComponent from "./components/dataflow-tile";

import Icon from "./assets/program.svg";
import HeaderIcon from "./assets/program-tile-id.svg";
import { STATE_VERSION_CURRENT } from "./model/dataflow-state-versions";
import { convertLegacyDataflowProgram } from "./model/convert-legacy-dataflow";
import { legacyDataflowHistoryBridge } from "./model/legacy-dataflow-history-bridge";

export function tileSnapshotPreProcessor(tileSnap: any) {

  const program = tileSnap?.content?.program;
  if (program && program.id !== STATE_VERSION_CURRENT) {
    return {...tileSnap,
      content: { ...tileSnap.content,
        program: convertLegacyDataflowProgram(tileSnap.id, program)
      }
    };
  }
  return tileSnap;
}

registerTileContentInfo({
  type: kDataflowTileType,
  displayName: "Program",
  useContentTitle: true,
  modelClass: DataflowContentModel,
  metadataClass: TileMetadataModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent,
  isDataProvider: true,
  tileSnapshotPreProcessor,
  schemaVersion: {
    currentVersion: STATE_VERSION_CURRENT,
    getVersion: tile => tile?.content?.program?.id ?? STATE_VERSION_CURRENT,
    convertSnapshot: tileSnapshotPreProcessor
  }
});

registerHistoryBridge(legacyDataflowHistoryBridge);

registerTileComponentInfo({
  type: kDataflowTileType,
  Component: DataflowToolComponent,
  tileEltClass: "dataflow-tool-tile",
  Icon,
  HeaderIcon,
  // The tile manages its own selection so that Cmd/Ctrl/Shift-clicking nodes (to multi-select for
  // grouping) does not toggle the tile out of selection and hide the toolbar. See the
  // onPointerDownCapture handler in DataflowToolComponent.
  tileHandlesOwnSelection: true
});
