import React, { useContext } from "react";
import { observer } from "mobx-react";
import { AddTilesContext, TileModelContext } from "../../components/tiles/tile-api";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { isWaveRunnerContentModel } from "./models/wave-runner-content";
import { kTimelineTileType } from "../timeline/timeline-types";

import LoadDataIcon from "./assets/toolbar/load-data-icon.svg";
import RunIcon from "./assets/toolbar/run-icon.svg";
import RestartIcon from "./assets/toolbar/restart-icon.svg";
import ClearAndResetIcon from "./assets/toolbar/clear-and-reset-icon.svg";
import TimelineItIcon from "./assets/toolbar/timeline-it-icon.svg";

const LoadDataButton = observer(function LoadDataButton({ name }: IToolbarButtonComponentProps) {
  const tileModel = useContext(TileModelContext);
  const content = tileModel?.content;
  if (!isWaveRunnerContentModel(content)) return null;
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
  const rawContent = tileModel?.content;
  const content = isWaveRunnerContentModel(rawContent) ? rawContent : undefined;
  const disabled = !content?.hasData;

  function handleClick() {
    if (!tileModel || !addTilesContext || !content) return;
    const sharedSeismogram = content.sharedSeismogram;
    const sharedModels = sharedSeismogram ? [sharedSeismogram] : undefined;
    addTilesContext.addTileAfter(kTimelineTileType, tileModel, sharedModels);
  }

  if (!content) return null;

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
