import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kSimulatorDefaultHeight, kSimulatorTileType } from "./simulator-types";
import SimulatorToolIcon from "./assets/simulator-icon.svg";
import { SimulatorTileComponent } from "./components/simulator-tile";
import { defaultSimulatorContent, SimulatorContentModel } from "./model/simulator-content";

registerTileContentInfo({
  defaultContent: defaultSimulatorContent,
  defaultHeight: kSimulatorDefaultHeight,
  modelClass: SimulatorContentModel,
  titleBase: "Simulation",
  type: kSimulatorTileType,
});

registerTileComponentInfo({
  Component: SimulatorTileComponent,
  Icon: SimulatorToolIcon,
  tileEltClass: "simulator-tool-tile",
  type: kSimulatorTileType,
});
