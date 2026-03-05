import React from "react";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";

import LoadDataIcon from "./assets/toolbar/load-data-icon.svg";
import RunIcon from "./assets/toolbar/run-icon.svg";
import RestartIcon from "./assets/toolbar/restart-icon.svg";
import ClearAndResetIcon from "./assets/toolbar/clear-and-reset-icon.svg";
import TimelineItIcon from "./assets/toolbar/timeline-it-icon.svg";

function LoadDataButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Load Data"
      onClick={() => undefined}
      disabled={true}
    >
      <LoadDataIcon/>
    </TileToolbarButton>
  );
}

function PlayButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Run Model"
      onClick={() => undefined}
      disabled={true}
    >
      <RunIcon/>
    </TileToolbarButton>
  );
}

function RestartButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Restart Model"
      onClick={() => undefined}
      disabled={true}
    >
      <RestartIcon/>
    </TileToolbarButton>
  );
}

function ResetButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Clear & Reset Model"
      onClick={() => undefined}
      disabled={true}
    >
      <ClearAndResetIcon/>
    </TileToolbarButton>
  );
}

function TimelineButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Timeline It!"
      onClick={() => undefined}
      disabled={true}
    >
      <TimelineItIcon/>
    </TileToolbarButton>
  );
}

registerTileToolbarButtons("wave-runner",
[
  { name: "load-data", component: LoadDataButton },
  { name: "play", component: PlayButton },
  { name: "restart", component: RestartButton },
  { name: "reset", component: ResetButton },
  { name: "timeline", component: TimelineButton }
]);
