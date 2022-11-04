import {
  DataflowContentModel, defaultDataflowContent, kDataflowDefaultHeight, kDataflowToolID
} from "./model/dataflow-content";
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { TileMetadataModel } from "../../models/tiles/tile-metadata";
import DataflowToolComponent from "./components/dataflow-tile";
import DataflowToolIcon from "./assets/program.svg";

registerTileContentInfo({
  id: kDataflowToolID,
  titleBase: "Program",
  modelClass: DataflowContentModel,
  metadataClass: TileMetadataModel,
  defaultHeight: kDataflowDefaultHeight,
  defaultContent: defaultDataflowContent
});

registerTileComponentInfo({
  id: kDataflowToolID,
  Component: DataflowToolComponent,
  tileEltClass: "dataflow-tool-tile",
  Icon: DataflowToolIcon
});
