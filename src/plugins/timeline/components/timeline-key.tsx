import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { getEventColorClass } from "../timeline-types";
import { EventShape } from "./event-shape";

import "./timeline-key.scss";

export const TimelineKey = observer(function TimelineKey() {
  const content = useTimelineContent();
  const readOnly = useReadOnlyContext();
  const colorWords = content.eventTypeColorWords;

  return (
    <div className="timeline-key">
      <div className="key-title">Event Key</div>
      {Array.from(colorWords.entries()).map(([eventType, colorWord]) => (
        // The label is what names the checkbox for assistive technology; the icon is decorative.
        <label key={eventType} className={classNames("event-type-entry", getEventColorClass(colorWord))}>
          <span className="key-checkbox">
            <input
              type="checkbox"
              checked={!content.isEventTypeHidden(eventType)}
              onChange={() => readOnly
                ? content.toggleEventTypeForReader(eventType)
                : content.toggleEventType(eventType)}
            />
            <EventShape colorWord={colorWord} onDark />
          </span>
          <span className="event-type-label">{eventType}</span>
        </label>
      ))}
    </div>
  );
});
