import { observer } from "mobx-react-lite";
import React from "react";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { TimeLabel } from "./time-label";

import "./time-marker-overlay.scss";

function isPctInView(pct?: number): pct is number {
  return pct !== undefined && pct >= 0 && pct <= 100;
}

export const TimeMarkerOverlay = observer(function TimeMarkerOverlay() {
  const content = useTimelineContent();
  const { hoverTime, markerTime } = content;
  const hoverPct = hoverTime ? content.timeToViewPct(hoverTime) : undefined;
  const markerPct = markerTime ? content.timeToViewPct(markerTime) : undefined;

  const handleMarkerLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    content.clearMarkerTime();
  };

  return (
    <>
      {markerTime && isPctInView(markerPct) && (
        <>
          <div className="time-marker-line placed" style={{ left: `${markerPct}%` }} />
          <button
            className="time-marker-label placed"
            onClick={handleMarkerLabelClick}
            style={{ left: `${markerPct}%` }}
            type="button"
          >
            <TimeLabel time={markerTime} />
          </button>
        </>
      )}
      {hoverTime && isPctInView(hoverPct) && (
        <>
          <div className="time-marker-line hover" style={{ left: `${hoverPct}%` }} />
          <div className="time-marker-label hover" style={{ left: `${hoverPct}%` }}>
            <TimeLabel time={hoverTime} />
          </div>
        </>
      )}
    </>
  );
});
