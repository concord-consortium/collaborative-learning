import { observer } from "mobx-react";
import React, { useContext } from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { isTimelineContentModel } from "../models/timeline-content";
import { Timeline } from "./timeline";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({ readOnly, tileElt }) {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="timeline-container">
        <div className="event-row">
          <button disabled={!model?.canSelectPrev} onClick={() => model?.selectPrevEvent()}>Prev</button>
          <button disabled={!model?.canSelectNext} onClick={() => model?.selectNextEvent()}>Next</button>
          <div className="event-label">{model?.selectedEventLabel ?? "Event"}</div>
        </div>
        <Timeline />
        <TimelineKey />
      </div>
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
