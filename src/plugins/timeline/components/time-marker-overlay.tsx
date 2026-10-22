import classNames from "classnames";
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React, { useRef, useState } from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { useLiveAnnouncer } from "../../../hooks/use-live-announcer";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { formatTime } from "./describe-view";
import { TimeLabel } from "./time-label";
import { focusFirstContentControl } from "./timeline-content-controls";

import "./time-marker-overlay.scss";

// A keyboard nudge of the marker, as a fraction of the visible view.
const kKeyboardStepFraction = 0.05;
const kKeyboardLargeStepFraction = 0.2;

/** The stem is the marker's keyboard control; the toolbar hands focus to it. */
export const kMarkerStemTestId = "marker-stem";

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
  const { announcerRef, announce } = useLiveAnnouncer();
  // Where the marker sits mid-drag. The model is written once, on pointer-up.
  const [dragTime, setDragTime] = useState<DateTime | undefined>(undefined);
  // pointermove is a continuous-priority update, so a pointerup can arrive before the render that
  // would carry the latest dragTime. The ref is what gets committed; the state is what gets drawn.
  const dragTimeRef = useRef<DateTime | undefined>(undefined);
  const dragPointerRef = useRef<number | undefined>(undefined);
  const isDragging = dragTime !== undefined;

  const setDrag = (time: DateTime | undefined) => {
    dragTimeRef.current = time;
    setDragTime(time);
  };

  const placedTime = dragTime ?? markerTime;
  const placedPct = placedTime ? content.timeToViewPct(placedTime) : undefined;

  // Clamped to the view, as a keyboard nudge is. viewPctToTime only clamps to the data, which
  // would let a drag past the edge of the plot commit a time the view does not reach, so the
  // marker would vanish on release until the student panned to it.
  const timeAtClientX = (clientX: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return undefined;
    return content.viewPctToTime(clampPct((clientX - rect.left) / rect.width * 100));
  };

  const handleDragStart = (e: React.PointerEvent) => {
    // A second finger on the other grip would otherwise take over the drag mid-gesture.
    if (e.button !== 0 || dragPointerRef.current !== undefined) return;
    dragPointerRef.current = e.pointerId;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag(content.markerTime);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (dragPointerRef.current !== e.pointerId) return;
    const time = timeAtClientX(e.clientX);
    if (time) setDrag(time);
  };

  const endDrag = (e: React.PointerEvent, commit: boolean) => {
    if (dragPointerRef.current !== e.pointerId) return;
    dragPointerRef.current = undefined;
    const dragged = dragTimeRef.current;
    // Only when it moved: a press and release in place would otherwise rewrite the stored ISO,
    // which for a curriculum-authored time is a different string and so a no-op undo entry.
    if (commit && dragged && dragged.toMillis() !== content.markerTime?.toMillis()) {
      content.setMarkerTime(dragged);
    }
    setDrag(undefined);
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
    // A press on the stem focuses it, so Delete can arrive mid-drag. Left alone, the drag would
    // go on drawing the marker and commit it again on pointer-up.
    dragPointerRef.current = undefined;
    setDrag(undefined);
    announce("Marker deleted.");
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

  // The stem is the marker's keyboard control, and a slider over the visible view: nudged out of
  // the view the marker would stop being drawn, taking the focused control with it.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (placedPct === undefined) return;
    let pct = placedPct;
    let deleting = false;
    switch (e.key) {
      case "ArrowLeft": case "ArrowDown": pct -= kKeyboardStepFraction * 100; break;
      case "ArrowRight": case "ArrowUp": pct += kKeyboardStepFraction * 100; break;
      case "PageDown": pct -= kKeyboardLargeStepFraction * 100; break;
      case "PageUp": pct += kKeyboardLargeStepFraction * 100; break;
      case "Home": pct = 0; break;
      case "End": pct = 100; break;
      case "Delete": case "Backspace": deleting = true; break;
      default: return;
    }
    e.preventDefault();
    // Keep the keys the slider uses from also acting on a container, such as a tile's ArrowUp exit,
    // as the Full Timeline's scrollbar thumb does.
    e.stopPropagation();
    if (deleting) {
      deleteMarker(e.currentTarget, true);
      return;
    }
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
      <div ref={announcerRef} className="visually-hidden" aria-live="polite" />
      {/* Unmounting the marker mid-drag would take the captured pointer's target with it, so
          pointer-up would never arrive: the move would be lost and the drag left armed. The drag
          clamps to the view, so this only covers rounding right at its edge. */}
      {placedTime && placedPct !== undefined && (isDragging || isPctInView(placedPct)) && (
        <>
          <div
            className={classNames("time-marker-line", "placed", { interactive: !readOnly, dragging: isDragging })}
            data-testid={kMarkerStemTestId}
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
      {/* The preview belongs to placement: it is dashed to say the marker is not settled yet,
          and there is nothing it could mean once placement has ended. */}
      {content.isPlacingMarker && hoverTime && isPctInView(hoverPct) && (
        <>
          <div className="time-marker-line placing" style={{ left: `${hoverPct}%` }} />
          <div className="time-marker-label placing" style={{ left: `${hoverPct}%` }}>
            <TimeLabel time={hoverTime} />
          </div>
        </>
      )}
    </div>
  );
});
