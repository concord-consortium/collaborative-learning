import React, { useContext } from "react";
import { observer } from "mobx-react";
import { AddTilesContext, TileModelContext } from "../../components/tiles/tile-api";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { SharedSeismogram } from "../shared-seismogram/shared-seismogram";
import { kTimelineTileType } from "../timeline/timeline-types";
import { useWaveRunnerContent } from "./hooks/use-wave-runner-content";

import LoadDataIcon from "./assets/toolbar/load-data-icon.svg";
import RunIcon from "./assets/toolbar/run-icon.svg";
import RestartIcon from "./assets/toolbar/restart-icon.svg";
import ClearAndResetIcon from "./assets/toolbar/clear-and-reset-icon.svg";
import TimelineItIcon from "./assets/toolbar/timeline-it-icon.svg";

const LoadDataButton = observer(function LoadDataButton({ name }: IToolbarButtonComponentProps) {
  const content = useWaveRunnerContent();
  const disabled = content.isLoading || content.hasData;
  return (
    <TileToolbarButton name={name} title="Load Data" onClick={() => content.loadData()} disabled={disabled}>
      <LoadDataIcon/>
    </TileToolbarButton>
  );
});

function PlayButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton name={name} title="Run Model" onClick={() => undefined} disabled={true}>
      <RunIcon/>
    </TileToolbarButton>
  );
}

function RestartButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton name={name} title="Restart Model" onClick={() => undefined} disabled={true}>
      <RestartIcon/>
    </TileToolbarButton>
  );
}

function ResetButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton name={name} title="Clear & Reset Model" onClick={() => undefined} disabled={true}>
      <ClearAndResetIcon/>
    </TileToolbarButton>
  );
}

const TimelineButton = observer(function TimelineButton({ name }: IToolbarButtonComponentProps) {
  const tileModel = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const content = useWaveRunnerContent();
  const disabled = !content.hasData;

  function handleClick() {
    if (!tileModel || !addTilesContext) return;
    const sharedSeismogram = content.sharedSeismogram;
    if (!sharedSeismogram?.seismogram) return;
    // Create a copy so the Timeline keeps its data when Wave Runner reloads.
    const copy = SharedSeismogram.create({
      startTimeISO: sharedSeismogram.startTimeISO,
      endTimeISO: sharedSeismogram.endTimeISO,
    });
    copy.setSeismogram(sharedSeismogram.seismogram);
    addTilesContext.addTileAfter(kTimelineTileType, tileModel, [copy]);
  }

  return (
    <TileToolbarButton name={name} title="Timeline It!" onClick={handleClick} disabled={disabled}>
      <TimelineItIcon/>
    </TileToolbarButton>
  );
});

registerTileToolbarButtons("wave-runner",
[
  { name: "load-data", component: LoadDataButton },
  { name: "play", component: PlayButton },
  { name: "restart", component: RestartButton },
  { name: "reset", component: ResetButton },
  { name: "timeline", component: TimelineButton }
]);
