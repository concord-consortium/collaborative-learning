import { observer } from "mobx-react-lite";
import React from "react";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { getEventColorGroup } from "../timeline-event-colors";
import { TimelineEvent } from "../timeline-types";

import "./event-overlay.scss";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const EventOverlay = observer(function EventOverlay() {
  const content = useTimelineContent();
  const startTime = content.viewStartTime;
  const endTime = content.viewEndTime;
  const visibleEvents = content.visibleEvents;
  const colorWords = content.eventTypeColorWords;

  function getEventPosition(event: TimelineEvent) {
    if (!startTime || !endTime) return null;
    const viewStartMs = startTime.toMillis();
    const viewEndMs = endTime.toMillis();
    const viewDuration = viewEndMs - viewStartMs;
    if (viewDuration <= 0) return null;

    const leftPct = (Math.max(event.windowStart.toMillis(), viewStartMs) - viewStartMs) / viewDuration * 100;
    const rightPct = (Math.min(event.windowEnd.toMillis(), viewEndMs) - viewStartMs) / viewDuration * 100;
    const widthPct = rightPct - leftPct;

    return { leftPct, widthPct };
  }

  return (
    <>
      {visibleEvents.map((event, i) => {
        const pos = getEventPosition(event);
        if (!pos) return null;

        const colorWord = colorWords.get(event.eventType);
        const color = getEventColorGroup(colorWord ?? "").default;
        const overlayStyle = {
          backgroundColor: hexToRgba(color, 0.5),
          border: `1px solid ${color}`,
          left: `${pos.leftPct}%`,
          width: `${pos.widthPct}%`,
        };
        const labelStyle = {
          backgroundColor: color,
          left: `${pos.leftPct + pos.widthPct / 2}%`,
        };
        const onLabelClick = () => content.selectEvent(event.index);

        return (
          <React.Fragment key={i}>
            <div className="event-overlay" style={overlayStyle} />
            <button className="event-label-button" style={labelStyle} onClick={onLabelClick}>
              {event.index + 1}
            </button>
          </React.Fragment>
        );
      })}
    </>
  );
});
