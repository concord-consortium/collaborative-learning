import { observer } from "mobx-react";
import React, { useContext } from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isTimelineContentModel } from "../models/timeline-content";
import { Timeline } from "./timeline";
import { TimelineKey } from "./timeline-key";
import { TimelineScrollbar } from "./timeline-scrollbar";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(function TimelineComponent({ readOnly, tileElt }) {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  if (!model) return null;

  const { dataStartTime, dataEndTime, viewStartTime, viewEndTime, setViewRange } = model;
  const showScrollbar = dataStartTime != null && dataEndTime != null && viewStartTime != null && viewEndTime != null;

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="timeline-container">
        <div className="event-row">
          <button disabled={true}>Prev</button>
          <button disabled={true}>Next</button>
          <div className="event-label">Event</div>
        </div>
        <Timeline />
        {showScrollbar && (
          <TimelineScrollbar
            dataStartTime={dataStartTime}
            dataEndTime={dataEndTime}
            viewStartTime={viewStartTime}
            viewEndTime={viewEndTime}
            onViewChange={setViewRange}
          />
        )}
        <TimelineKey />
      </div>
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
