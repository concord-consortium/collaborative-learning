import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kSimulatorDefaultHeight, kSimulatorTileType } from "./simulator-types";
import { SimulatorTileComponent } from "./components/simulator-tile";
import { defaultSimulatorContent, SimulatorContentModel } from "./model/simulator-content";

import Icon from "./assets/simulator-icon.svg";
import HeaderIcon from "./assets/simulator-tile-id.svg";

registerTileContentInfo({
  defaultContent: defaultSimulatorContent,
  defaultHeight: kSimulatorDefaultHeight,
  modelClass: SimulatorContentModel,
  displayName: "Simulator",
  titleBase: "Simulation",
  type: kSimulatorTileType,
});

registerTileComponentInfo({
  Component: SimulatorTileComponent,
  Icon,
  HeaderIcon,
  tileEltClass: "simulator-tool-tile",
  type: kSimulatorTileType,
});
