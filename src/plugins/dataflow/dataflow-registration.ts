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
import {
  getDataflowProgramVersion, STATE_VERSION_CURRENT, STATE_VERSION_RETE_V1
} from "./model/dataflow-state-versions";
import { convertLegacyDataflowProgram } from "./model/convert-legacy-dataflow";
import { legacyDataflowHistoryBridge } from "./model/legacy-dataflow-history-bridge";

function getDataflowTileVersion(tileSnap: any): string {
  return getDataflowProgramVersion(tileSnap?.content?.program);
}

/**
 * Converts a DataFlow tile's JSON to the current program format. A current tile, or one with no
 * program, is returned as it is. Returns undefined for a program format this release doesn't
 * convert, such as one saved by a newer release.
 */
export function convertDataflowTileSnapshot(tileSnap: any) {
  const version = getDataflowTileVersion(tileSnap);
  if (version === STATE_VERSION_CURRENT) return tileSnap;
  if (version !== STATE_VERSION_RETE_V1) return undefined;
  return {...tileSnap,
    content: { ...tileSnap.content,
      program: convertLegacyDataflowProgram(tileSnap.id, tileSnap.content.program)
    }
  };
}

export function tileSnapshotPreProcessor(tileSnap: any) {
  return convertDataflowTileSnapshot(tileSnap) ?? tileSnap;
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
    getVersion: getDataflowTileVersion,
    convertSnapshot: convertDataflowTileSnapshot
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
