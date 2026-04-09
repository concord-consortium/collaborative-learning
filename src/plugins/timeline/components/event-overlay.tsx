import { observer } from "mobx-react-lite";
import React, { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isTimelineContentModel, TimelineEvent } from "../models/timeline-content";
import { kEventColorMap, EventColorWord } from "../timeline-event-colors";

import "./event-overlay.scss";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const EventOverlay = observer(function EventOverlay() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  if (!model) return null;

  const startTime = model.viewStartTime;
  const endTime = model.viewEndTime;
  const visibleEvents = model.visibleEvents;
  const colorWords = model.eventTypeColorWords;

  function getEventPosition(event: TimelineEvent) {
    if (!startTime || !endTime) return null;
    const viewStartMs = startTime.toMillis();
    const viewEndMs = endTime.toMillis();
    const viewDuration = viewEndMs - viewStartMs;
    if (viewDuration <= 0) return null;

    const leftPct = ((event.windowStart.toMillis() - viewStartMs) / viewDuration) * 100;
    const rightPct = ((event.windowEnd.toMillis() - viewStartMs) / viewDuration) * 100;
    const widthPct = rightPct - leftPct;

    return { leftPct, widthPct };
  }

  return (
    <>
      {visibleEvents.map((event, i) => {
        const pos = getEventPosition(event);
        if (!pos) return null;
        const colorWord = colorWords.get(event.eventType) as EventColorWord | undefined;
        const color = colorWord ? kEventColorMap[colorWord].default : "#aad7ff";
        return (
          <React.Fragment key={i}>
            <div
              className="event-overlay"
              style={{
                left: `${pos.leftPct}%`,
                width: `${pos.widthPct}%`,
                backgroundColor: hexToRgba(color, 0.5),
              }}
              onClick={() => model.selectEvent(event.index)}
            />
            <button
              className="event-label-button"
              style={{
                left: `${pos.leftPct + pos.widthPct / 2}%`,
                backgroundColor: color,
              }}
              onClick={() => model.selectEvent(event.index)}
            >
              {event.index + 1}
            </button>
          </React.Fragment>
        );
      })}
    </>
  );
});
