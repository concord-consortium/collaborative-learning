import { observer } from "mobx-react";
import React from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { Timeline } from "./timeline";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";
import { useTimelineContent } from "../hooks/use-timeline-content";

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({ readOnly, tileElt }) {
  const content = useTimelineContent();

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="timeline-container">
        <div className="event-row">
          <button disabled={!content.canSelectPrev} onClick={() => content.selectPrevEvent()}>Prev</button>
          <button disabled={!content.canSelectNext} onClick={() => content.selectNextEvent()}>Next</button>
          <div className="event-label">{content.selectedEventLabel}</div>
        </div>
        <Timeline />
        <TimelineKey />
      </div>
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
