import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { useId } from "react";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { getEventColorClass } from "../timeline-types";
import { EventShape } from "./event-shape";
import { useHiddenEventTypes } from "./hidden-event-types-context";

import "./timeline-key.scss";

export const TimelineKey = observer(function TimelineKey() {
  const content = useTimelineContent();
  const hiddenEventTypes = useHiddenEventTypes();
  const colorWords = content.eventTypeColorWords;
  // One per Key: a document can hold several Timeline tiles, and show each in more than one pane.
  const titleId = useId();

  return (
    <div className="timeline-key" role="group" aria-labelledby={titleId}>
      <div className="key-title" id={titleId}>Event Key</div>
      {Array.from(colorWords.entries()).map(([eventType, colorWord]) => (
        // The label is what names the checkbox for assistive technology; the icon is decorative.
        <label key={eventType} className={classNames("event-type-entry", getEventColorClass(colorWord))}>
          <span className="key-checkbox">
            <input
              type="checkbox"
              checked={!hiddenEventTypes.types.includes(eventType)}
              onChange={() => hiddenEventTypes.toggle(eventType)}
            />
            <EventShape colorWord={colorWord} onDark />
          </span>
          <span className="event-type-label">{eventType}</span>
        </label>
      ))}
    </div>
  );
});
