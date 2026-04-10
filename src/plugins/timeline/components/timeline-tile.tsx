import { observer } from "mobx-react";
import React from "react";
import ScrollArrowIcon from "../../../assets/scroll-arrow-small-icon.svg";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { Timeline } from "./timeline";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({ readOnly, tileElt }) {
  const content = useTimelineContent();

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="timeline-container">
        <div className="event-row">
          <button
            className="timeline-button prev-button"
            disabled={!content.canSelectPrev}
            onClick={() => content.selectPrevEvent()}
          >
            <ScrollArrowIcon /><span>Prev</span>
          </button>
          <button
            className="timeline-button next-button"
            disabled={!content.canSelectNext}
            onClick={() => content.selectNextEvent()}
          >
            <span>Next</span><ScrollArrowIcon style={{ transform: "rotate(180deg)" }} />
          </button>
          <div className="event-label">{content.selectedEventLabel}</div>
        </div>
        <Timeline />
        <TimelineKey />
      </div>
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
