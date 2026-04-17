import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { getEventColorClass } from "../timeline-types";

import "./timeline-key.scss";

export const TimelineKey = observer(function TimelineKey() {
  const content = useTimelineContent();
  const colorWords = content.eventTypeColorWords;

  return (
    <div className="timeline-key">
      <div className="key-title">Event Key</div>
      {Array.from(colorWords.entries()).map(([eventType, colorWord]) => {
        const colorClass = getEventColorClass(colorWord);
        return (
          <div key={eventType} className="event-type-entry">
            <div className={clsx("color-swatch", colorClass)} />
            <span className="event-type-label">{eventType}</span>
          </div>
        );
      })}
    </div>
  );
});
