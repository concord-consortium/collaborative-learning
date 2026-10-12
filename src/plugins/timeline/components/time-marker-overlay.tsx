import classNames from "classnames";
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React, { useRef, useState } from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { formatTime } from "./describe-view";
import { TimeLabel } from "./time-label";
import { focusFirstContentControl } from "./timeline-content-controls";

import "./time-marker-overlay.scss";

// A keyboard nudge of the marker, as a fraction of the visible view. The Full Timeline's scrollbar
// steps its view by the same fractions.
const kKeyboardStepFraction = 0.05;
const kKeyboardLargeStepFraction = 0.2;

function isPctInView(pct?: number): pct is number {
  return pct !== undefined && pct >= 0 && pct <= 100;
}

function clampPct(pct: number) {
  return Math.max(0, Math.min(100, pct));
}

export const TimeMarkerOverlay = observer(function TimeMarkerOverlay() {
  const content = useTimelineContent();
  const readOnly = useReadOnlyContext();
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

  // The stem and the label are two grips on the same marker. Capture can be lost without a cancel —
  // a capture change fires lostpointercapture on its own — so, as in TimelinePlot, every way of
  // losing it ends the drag. A committed drag has already cleared itself by then.
  const dragHandlers = {
    onPointerDown: handleDragStart,
    onPointerMove: handleDragMove,
    onPointerUp: (e: React.PointerEvent) => endDrag(e, true),
    onPointerCancel: (e: React.PointerEvent) => endDrag(e, false),
    onLostPointerCapture: (e: React.PointerEvent) => endDrag(e, false),
  };

  // The marker takes the focus with it when it goes, so hand focus back to the tile.
  const deleteMarker = (from: HTMLElement, restoreFocus: boolean) => {
    content.clearMarkerTime();
    if (restoreFocus) focusFirstContentControl(from);
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    deleteMarker(e.currentTarget, e.currentTarget === document.activeElement);
  };

  // A pointerdown on the delete button would otherwise bubble up to the label and start a drag.
  const handleDeletePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  // The stem is the marker's keyboard control: a slider over the visible view rather than over the
  // whole of the data a drag can reach. Nudged out of the view it would stop being drawn, taking
  // the focused control with it.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (placedPct === undefined) return;
    let pct = placedPct;
    switch (e.key) {
      case "ArrowLeft": case "ArrowDown": pct -= kKeyboardStepFraction * 100; break;
      case "ArrowRight": case "ArrowUp": pct += kKeyboardStepFraction * 100; break;
      case "PageDown": pct -= kKeyboardLargeStepFraction * 100; break;
      case "PageUp": pct += kKeyboardLargeStepFraction * 100; break;
      case "Home": pct = 0; break;
      case "End": pct = 100; break;
      case "Delete": case "Backspace":
        e.preventDefault();
        deleteMarker(e.currentTarget, true);
        return;
      default: return;
    }
    e.preventDefault();
    const time = content.viewPctToTime(clampPct(pct));
    if (time) content.setMarkerTime(time);
  };

  const sliderProps: React.HTMLAttributes<HTMLDivElement> & { tabIndex: number } = {
    "aria-label": "Time marker",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": Math.round(clampPct(placedPct ?? 0)),
    "aria-valuetext": placedTime ? formatTime(placedTime) : undefined,
    onKeyDown: handleKeyDown,
    role: "slider",
    tabIndex: 0,
  };

  return (
    <div ref={overlayRef} className="time-marker-overlay">
      {/* A drag can run past the edge of the view, where a placed marker is normally not drawn.
          Unmounting it mid-drag would take the captured pointer's target with it, so pointer-up
          would never arrive: the move would be lost and the drag left armed. Hold it at the edge. */}
      {placedTime && placedPct !== undefined && (isDragging || isPctInView(placedPct)) && (
        <>
          <div
            className={classNames("time-marker-line", "placed", { interactive: !readOnly, dragging: isDragging })}
            data-testid="marker-stem"
            style={{ left: `${clampPct(placedPct)}%` }}
            {...(readOnly ? {} : { ...dragHandlers, ...sliderProps })}
          />
          <div
            className={classNames("time-marker-label", "placed", { interactive: !readOnly, dragging: isDragging })}
            data-testid="marker-label"
            style={{ left: `${clampPct(placedPct)}%` }}
            {...(readOnly ? {} : dragHandlers)}
          >
            <TimeLabel time={placedTime} />
            {!readOnly && (
              <button
                aria-label="Delete marker"
                className="marker-delete"
                onClick={handleDeleteClick}
                onPointerDown={handleDeletePointerDown}
                type="button"
              >
                ×
              </button>
            )}
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
