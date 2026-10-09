import classNames from "classnames";
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React, { useRef, useState } from "react";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { TimeLabel } from "./time-label";

import "./time-marker-overlay.scss";

function isPctInView(pct?: number): pct is number {
  return pct !== undefined && pct >= 0 && pct <= 100;
}

export const TimeMarkerOverlay = observer(function TimeMarkerOverlay() {
  const content = useTimelineContent();
  const { hoverTime, markerTime } = content;
  const hoverPct = hoverTime ? content.timeToViewPct(hoverTime) : undefined;

  const overlayRef = useRef<HTMLDivElement>(null);
  // Where the marker sits mid-drag. The model is written once, on pointer-up.
  const [dragTime, setDragTime] = useState<DateTime | undefined>(undefined);
  const dragPointerRef = useRef<number | undefined>(undefined);
  const isDragging = dragTime !== undefined;

  const placedTime = dragTime ?? markerTime;
  const placedPct = placedTime ? content.timeToViewPct(placedTime) : undefined;

  const timeAtClientX = (clientX: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return undefined;
    return content.viewPctToTime((clientX - rect.left) / rect.width * 100);
  };

  const handleDragStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragPointerRef.current = e.pointerId;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragTime(content.markerTime);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (dragPointerRef.current !== e.pointerId) return;
    const time = timeAtClientX(e.clientX);
    if (time) setDragTime(time);
  };

  const endDrag = (e: React.PointerEvent, commit: boolean) => {
    if (dragPointerRef.current !== e.pointerId) return;
    dragPointerRef.current = undefined;
    if (commit && dragTime) content.setMarkerTime(dragTime);
    setDragTime(undefined);
  };

  // The stem and the label are two grips on the same marker.
  const dragHandlers = {
    onPointerDown: handleDragStart,
    onPointerMove: handleDragMove,
    onPointerUp: (e: React.PointerEvent) => endDrag(e, true),
    onPointerCancel: (e: React.PointerEvent) => endDrag(e, false),
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    content.clearMarkerTime();
  };

  // A pointerdown on the delete button would otherwise bubble up to the label and start a drag.
  const handleDeletePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <div ref={overlayRef} className="time-marker-overlay">
      {placedTime && isPctInView(placedPct) && (
        <>
          <div
            className={classNames("time-marker-line", "placed", { dragging: isDragging })}
            data-testid="marker-stem"
            style={{ left: `${placedPct}%` }}
            {...dragHandlers}
          />
          <div
            className={classNames("time-marker-label", "placed", { dragging: isDragging })}
            data-testid="marker-label"
            style={{ left: `${placedPct}%` }}
            {...dragHandlers}
          >
            <TimeLabel time={placedTime} />
            <button
              aria-label="Delete marker"
              className="marker-delete"
              onClick={handleDeleteClick}
              onPointerDown={handleDeletePointerDown}
              type="button"
            >
              ×
            </button>
          </div>
        </>
      )}
      {hoverTime && isPctInView(hoverPct) && (
        <>
          <div
            className={classNames("time-marker-line", content.isPlacingMarker ? "placing" : "hover")}
            style={{ left: `${hoverPct}%` }}
          />
          <div
            className={classNames("time-marker-label", content.isPlacingMarker ? "placing" : "hover")}
            style={{ left: `${hoverPct}%` }}
          >
            <TimeLabel time={hoverTime} />
          </div>
        </>
      )}
    </div>
  );
});
