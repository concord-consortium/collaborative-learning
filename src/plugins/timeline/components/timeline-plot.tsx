import classNames from "classnames";
import { DateTime } from "luxon";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef, useState } from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { useLiveAnnouncer } from "../../../hooks/use-live-announcer";
import { useTimelineContent } from "../hooks/use-timeline-content";

import "./timeline-plot.scss";

// A press that moves farther than this is a pan rather than a click.
const kDragThresholdPx = 5;

interface IDragState {
  pointerId: number;
  startX: number;
  startY: number;
  startViewStartMs: number;
  msPerPx: number;
  moved: boolean;
}

function formatTime(time: DateTime) {
  return time.toUTC().toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
}

interface IProps {
  children: React.ReactNode;
}

/**
 * Wraps the timeline graph: a click zooms in centered on the clicked time, a shift-click zooms
 * out, and a drag pans. Read-only, it only displays the graph.
 */
export const TimelinePlot = observer(function TimelinePlot({ children }: IProps) {
  const content = useTimelineContent();
  const readOnly = useReadOnlyContext();
  const dragRef = useRef<IDragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isShiftDown, setIsShiftDown] = useState(false);
  const { announcerRef, announce } = useLiveAnnouncer();

  // Save a drag that is still in progress when the plot goes away.
  useEffect(() => () => {
    if (dragRef.current?.moved) content.endViewPreview();
  }, [content]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftDown(e.type === "keydown");
    };
    const handleBlur = () => setIsShiftDown(false);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const timeAtClientX = (e: React.PointerEvent<HTMLDivElement>) => {
    const { viewStartTime, viewRangeMs } = content;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!viewStartTime || !viewRangeMs || rect.width <= 0) return undefined;
    return viewStartTime.plus({ milliseconds: (e.clientX - rect.left) / rect.width * viewRangeMs });
  };

  const describeView = () => {
    const { viewStartTime, viewEndTime } = content;
    return viewStartTime && viewEndTime
      ? `Showing ${formatTime(viewStartTime)} to ${formatTime(viewEndTime)}.`
      : "";
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const { viewStartMs, viewRangeMs } = content;
    const width = e.currentTarget.getBoundingClientRect().width;
    if (e.button !== 0 || dragRef.current || viewStartMs == null || !viewRangeMs || width <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startViewStartMs: viewStartMs,
      msPerPx: viewRangeMs / width,
      moved: false
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsShiftDown(e.shiftKey);
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.hypot(dx, e.clientY - drag.startY) <= kDragThresholdPx) return;
      drag.moved = true;
      setIsDragging(true);
      content.beginViewPreview();
    }
    // Pan relative to where the drag started, so the view stays under the pointer.
    const targetStartMs = drag.startViewStartMs - dx * drag.msPerPx;
    content.panBy((targetStartMs - (content.viewStartMs ?? targetStartMs)) / 1000);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (drag?.moved) content.endViewPreview();
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    endDrag(e);
    if (drag.moved) {
      const panned = content.viewStartMs !== drag.startViewStartMs;
      announce(`${panned ? "Panned." : "Already at the edge of the data."} ${describeView()}`);
      return;
    }
    const time = timeAtClientX(e);
    if (!time) return;
    if (e.shiftKey && !content.canZoomOut) {
      announce(`Already showing the full time range. ${describeView()}`);
      return;
    }
    let action = "Zoomed in";
    if (e.shiftKey) action = "Zoomed out";
    else if (!content.canZoomIn) action = "Already at the closest zoom";
    content.zoom(e.shiftKey ? 2 : 0.5, time);
    // Near the edges of the data, the view is shifted rather than centered on the clicked time.
    const { viewStartMs = 0, viewRangeMs = 0 } = content;
    const centered = Math.abs(viewStartMs + viewRangeMs / 2 - time.toMillis()) <= 1;
    announce(`${action}${centered ? `, centered on ${formatTime(time)}` : ""}. ${describeView()}`);
  };

  // Also handles a lost pointer capture, so a missed pointerup can't leave a drag running.
  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) endDrag(e);
  };

  if (readOnly) {
    return <div className="timeline-plot">{children}</div>;
  }

  const cursorClass = isDragging ? "grabbing" : isShiftDown ? "zoom-out" : "zoom-in";

  return (
    <>
      <div
        className={classNames("timeline-plot", cursorClass)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
      >
        {children}
      </div>
      <div ref={announcerRef} className="visually-hidden" aria-live="polite" />
    </>
  );
});
