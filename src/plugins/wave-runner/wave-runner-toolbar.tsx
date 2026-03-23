import React, { useContext } from "react";
import { observer } from "mobx-react";
import { AddTilesContext, TileModelContext } from "../../components/tiles/tile-api";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { kTableTileType } from "../../models/tiles/table/table-content";
import { kTimelineTileType } from "../timeline/timeline-types";
import { isWaveRunnerContentModel } from "./models/wave-runner-content";

import LoadDataIcon from "./assets/toolbar/load-data-icon.svg";
import RunIcon from "./assets/toolbar/run-icon.svg";
import RestartIcon from "./assets/toolbar/restart-icon.svg";
import ClearAndResetIcon from "./assets/toolbar/clear-and-reset-icon.svg";
import TimelineIcon from "../timeline/assets/timeline-icon.svg";
import TableIcon from "../../clue/assets/icons/table-tool.svg";
import ViewBadgeIcon from "../../assets/icons/view/view-badge.svg";
import { BadgedIcon } from "../../components/toolbar/badged-icon";

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

const PlayButton = observer(function PlayButton({ name }: IToolbarButtonComponentProps) {
  const tileModel = useContext(TileModelContext);
  const content = tileModel?.content;

  if (!isWaveRunnerContentModel(content)) return null;

  const disabled = content.isRunning || !content.selectedModelUrl;
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

const TableItButton = observer(function TableItButton({ name }: IToolbarButtonComponentProps) {
  const tileModel = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const rawContent = tileModel?.content;
  const content = isWaveRunnerContentModel(rawContent) ? rawContent : undefined;
  const disabled = !content?.eventsFound;

  function handleClick() {
    if (!tileModel || !addTilesContext || !content) return;
    const sharedDataSet = content.getOrCreateEventsDataSet();
    const sharedModels = sharedDataSet ? [sharedDataSet] : undefined;
    addTilesContext.addTileAfter(kTableTileType, tileModel, sharedModels);
  }

  return (
    <TileToolbarButton name={name} title="Table It!" onClick={handleClick} disabled={disabled}>
      <BadgedIcon Icon={TableIcon} Badge={ViewBadgeIcon}/>
    </TileToolbarButton>
  );
});

const TimelineButton = observer(function TimelineButton({ name }: IToolbarButtonComponentProps) {
  const tileModel = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const rawContent = tileModel?.content;
  const content = isWaveRunnerContentModel(rawContent) ? rawContent : undefined;
  const disabled = !content?.hasData;

  function handleClick() {
    if (!tileModel || !addTilesContext || !content) return;
    const sharedDataSet = content.getOrCreateEventsDataSet();
    const sharedSeismogram = content.sharedSeismogram;
    const sharedModels = [sharedDataSet, sharedSeismogram].filter(Boolean) as any[];
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
  { name: "table-it", component: TableItButton },
  { name: "timeline", component: TimelineButton }
]);
