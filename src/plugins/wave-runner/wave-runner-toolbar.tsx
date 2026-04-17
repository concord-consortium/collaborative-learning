import React, { useContext } from "react";
import { getSnapshot } from "mobx-state-tree";
import { observer } from "mobx-react";
import { AddTilesContext, TileModelContext } from "../../components/tiles/tile-api";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { BadgedIcon } from "../../components/toolbar/badged-icon";
import { DataSetViewButton } from "../../components/toolbar/data-set-view-button";
import { SharedSeismogram } from "../shared-seismogram/shared-seismogram";
import { kTimelineTileType } from "../timeline/timeline-types";
import { useWaveRunnerContent } from "./hooks/use-wave-runner-content";

import LoadDataIcon from "./assets/toolbar/load-data-icon.svg";
import RunIcon from "./assets/toolbar/run-icon.svg";
import RestartIcon from "./assets/toolbar/restart-icon.svg";
import ClearAndResetIcon from "./assets/toolbar/clear-and-reset-icon.svg";
import TimelineIcon from "../timeline/assets/timeline-icon.svg";
import ViewBadgeIcon from "../../assets/icons/view/view-badge.svg";

const LoadDataButton = observer(function LoadDataButton({ name }: IToolbarButtonComponentProps) {
  const content = useWaveRunnerContent();
  return (
    <TileToolbarButton name={name} title="Load Data" onClick={() => content.loadData()} disabled={true}>
      <LoadDataIcon/>
    </TileToolbarButton>
  );
});

const PlayButton = observer(function PlayButton({ name }: IToolbarButtonComponentProps) {
  const content = useWaveRunnerContent();
  const disabled = content.isRunning || !content.selectedModelUrl || !!content.eventsDataSet;
  return (
    <TileToolbarButton name={name} title="Run Model" onClick={() => content.runModel()} disabled={disabled}>
      <RunIcon/>
    </TileToolbarButton>
  );
});

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
  const disabled = !content.sharedSeismogram?.station;

  function handleClick() {
    if (!tileModel || !addTilesContext) return;
    const sharedDataSet = content.eventsDataSet;
    const sharedSeismogram = content.sharedSeismogram;
    if (!sharedSeismogram?.station) return;
    // Create a copy so the Timeline keeps its data when Wave Runner reloads.
    const copy = SharedSeismogram.create({
      station: getSnapshot(sharedSeismogram.station),
      startTimeISO: sharedSeismogram.startTimeISO,
      endTimeISO: sharedSeismogram.endTimeISO,
    });
    const sharedModels = sharedDataSet ? [sharedDataSet, copy] : [copy];
    addTilesContext.addTileAfter(kTimelineTileType, tileModel, sharedModels);
  }

  return (
    <TileToolbarButton name={name} title="Timeline It!" onClick={handleClick} disabled={disabled}>
      <BadgedIcon Icon={TimelineIcon} Badge={ViewBadgeIcon}/>
    </TileToolbarButton>
  );
});

registerTileToolbarButtons("wave-runner",
[
  { name: "load-data", component: LoadDataButton },
  { name: "play", component: PlayButton },
  { name: "restart", component: RestartButton },
  { name: "reset", component: ResetButton },
  {
    // This button takes an argument saying what kind of tile it should create.
    name: "data-set-view",
    component: DataSetViewButton
  },
  { name: "timeline", component: TimelineButton }
]);
