import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { getEventColorClass, TimelineEvent } from "../timeline-types";
import { EventShape } from "./event-shape";

import "./event-overlay.scss";

export const EventOverlay = observer(function EventOverlay() {
  const content = useTimelineContent();
  const readOnly = useReadOnlyContext();
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
            <div className={classNames("event-overlay", colorClass)} style={overlayStyle} />
            {/* Outside the editable tile's Tab cycle until the graph has a keyboard design; Prev and
                Next select events by keyboard. A read-only tile has no cycle, so Tab reaches them there. */}
            <button
              className={classNames("event-label-button", colorClass)}
              style={labelStyle}
              onClick={onLabelClick}
              tabIndex={readOnly ? undefined : -1}
            >
              {event.index + 1}
            </button>
            <div className="event-label-shape" style={labelStyle}>
              <EventShape colorWord={colorWord} />
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
});
