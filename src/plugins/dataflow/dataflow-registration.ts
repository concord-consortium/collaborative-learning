import {
  DataflowContentModel, defaultDataflowContent, kDataflowDefaultHeight, kDataflowTileType
} from "./model/dataflow-content";
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { TileMetadataModel } from "../../models/tiles/tile-metadata";
import DataflowToolComponent from "./components/dataflow-tile";

import Icon from "./assets/program.svg";
import HeaderIcon from "./assets/program-tile-id.svg";

registerTileContentInfo({
  type: kDataflowTileType,
  displayName: "Program",
  useContentTitle: true,
  modelClass: DataflowContentModel,
  metadataClass: TileMetadataModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent,
  isDataProvider: true
});

registerTileComponentInfo({
  type: kDataflowTileType,
  Component: DataflowToolComponent,
  tileEltClass: "dataflow-tool-tile",
  Icon,
  HeaderIcon
});
