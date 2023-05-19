import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kSimulatorDefaultHeight, kSimulatorTileType } from "./simulator-types";
import SimulatorToolIcon from "./simulator-icon.svg";
import { SimulatorToolComponent } from "./simulator-tile";
import { defaultSimulatorContent, SimulatorContentModel } from "./simulator-content";

registerTileContentInfo({
  type: kSimulatorTileType,
  modelClass: SimulatorContentModel,
  defaultContent: defaultSimulatorContent,
  defaultHeight: kSimulatorDefaultHeight
});

registerTileComponentInfo({
  type: kSimulatorTileType,
  Component: SimulatorToolComponent,
  tileEltClass: "simulator-tool-tile",
  Icon: SimulatorToolIcon
});
