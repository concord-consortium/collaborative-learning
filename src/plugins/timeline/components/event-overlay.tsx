import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { getEventColorClass, TimelineEvent } from "../timeline-types";

import "./event-overlay.scss";

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
        const colorClass = getEventColorClass(colorWord ?? "");
        const overlayStyle = {
          left: `${pos.leftPct}%`,
          width: `${pos.widthPct}%`,
        };
        const labelStyle = { left: `${pos.leftPct + pos.widthPct / 2}%` };
        const onLabelClick = () => content.selectEvent(event.index);

        return (
          <React.Fragment key={i}>
            <div className={clsx("event-overlay", colorClass)} style={overlayStyle} />
            <button className={clsx("event-label-button", colorClass)} style={labelStyle} onClick={onLabelClick}>
              {event.index + 1}
            </button>
          </React.Fragment>
        );
      })}
    </>
  );
});
