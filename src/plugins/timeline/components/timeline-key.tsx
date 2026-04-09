import { observer } from "mobx-react-lite";
import React, { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isTimelineContentModel } from "../models/timeline-content";
import { kEventColorMap, EventColorWord } from "../timeline-event-colors";

import "./timeline-key.scss";

export const TimelineKey = observer(function TimelineKey() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  const colorWords = model?.eventTypeColorWords ?? new Map();

  return (
    <div className="timeline-key">
      <div className="key-title">Event Key</div>
      <div className="event-types">
        {Array.from(colorWords.entries()).map(([eventType, colorWord]) => {
          const color = kEventColorMap[colorWord as EventColorWord]?.default ?? "#aad7ff";
          return (
            <div key={eventType} className="event-type-entry">
              <div className="color-swatch" style={{ backgroundColor: color }} />
              <span className="event-type-label">{eventType}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
