import { observer } from "mobx-react-lite";
import React from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { TimeLabel } from "./time-label";

import "./time-marker-overlay.scss";

function isPctInView(pct?: number): pct is number {
  return pct !== undefined && pct >= 0 && pct <= 100;
}

export const TimeMarkerOverlay = observer(function TimeMarkerOverlay() {
  const content = useTimelineContent();
  const readOnly = useReadOnlyContext();
  const { hoverTime, pinnedTime } = content;
  const hoverPct = hoverTime ? content.timeToViewPct(hoverTime) : undefined;
  const pinnedPct = pinnedTime ? content.timeToViewPct(pinnedTime) : undefined;

  const handlePinnedLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    content.clearPinnedTime();
  };

  return (
    <>
      {pinnedTime && isPctInView(pinnedPct) && (
        <>
          <div className="time-marker-line pinned" style={{ left: `${pinnedPct}%` }} />
          {/* Outside the editable tile's Tab cycle, as the event labels are (see EventOverlay). */}
          <button
            className="time-marker-label pinned"
            onClick={handlePinnedLabelClick}
            style={{ left: `${pinnedPct}%` }}
            tabIndex={readOnly ? undefined : -1}
            type="button"
          >
            <TimeLabel time={pinnedTime} />
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
