import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kWaveRunnerDefaultHeight, kWaveRunnerTileType } from "./wave-runner-types";
import { WaveRunnerComponent } from "./components/wave-runner-tile";
import { defaultWaveRunnerContent, WaveRunnerContentModel } from "./models/wave-runner-content";

import Icon from "./assets/wave-runner-icon.svg";
import HeaderIcon from "./assets/wave-runner-tile-id.svg";

registerTileContentInfo({
  type: kWaveRunnerTileType,
  displayName: "Wave Runner",
  modelClass: WaveRunnerContentModel,
  defaultContent: defaultWaveRunnerContent,
  defaultHeight: kWaveRunnerDefaultHeight
});

registerTileComponentInfo({
  type: kWaveRunnerTileType,
  Component: WaveRunnerComponent,
  tileEltClass: "wave-runner-tool-tile",
  Icon,
  HeaderIcon
});
