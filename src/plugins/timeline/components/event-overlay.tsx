import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { getEventColorClass, TimelineEvent } from "../timeline-types";

import "./event-overlay.scss";

export const EventOverlay = observer(function EventOverlay() {
  const content = useTimelineContent();
  const visibleEvents = content.visibleEvents;
  const colorWords = content.eventTypeColorWords;

  function getEventPosition(event: TimelineEvent) {
    const startPct = content.timeToViewPct(event.windowStart);
    const endPct = content.timeToViewPct(event.windowEnd);
    if (startPct === undefined || endPct === undefined) return null;

    const leftPct = Math.max(startPct, 0);
    const widthPct = Math.min(endPct, 100) - leftPct;

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
