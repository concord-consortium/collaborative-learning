import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef, useState } from "react";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { useLiveAnnouncer } from "../../../hooks/use-live-announcer";
import { useTimelineContent } from "../hooks/use-timeline-content";
import { describeView, formatTime } from "./describe-view";

import "./timeline-plot.scss";

// A press that moves farther than this is a drag rather than a click.
const kDragThresholdPx = 5;

interface IDragState {
  pointerId: number;
  startX: number;
  startY: number;
  startViewStartMs: number;
  msPerPx: number;
  moved: boolean;
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

  // Save a drag that is still in progress when the plot goes away or becomes read-only. Removing
  // the plot's element sends its lost pointer capture to the document, not to the plot.
  useEffect(() => () => {
    if (dragRef.current?.moved) content.endViewPreview();
    dragRef.current = null;
    setIsDragging(false);
  }, [content, readOnly]);

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
      const dx = e.clientX - drag.startX;
      let result = "View unchanged.";
      if (content.viewStartMs !== drag.startViewStartMs) {
        result = "Panned.";
      } else if ((dx > 0 && !content.canPanLeft) || (dx < 0 && !content.canPanRight)) {
        result = "Already at the edge of the data.";
      }
      announce(`${result} ${describeView(content)}`);
      return;
    }
    const time = timeAtClientX(e);
    if (!time) return;
    // While placing, the click belongs to the marker: zooming would move the ground out from under it.
    if (content.isPlacingMarker) {
      content.setMarkerTime(time);
      announce(`Marker placed at ${formatTime(time)}.`);
      return;
    }
    if (e.shiftKey && !content.canZoomOut) {
      announce(`Already showing the full time range. ${describeView(content)}`);
      return;
    }
    let action = "Zoomed in";
    if (e.shiftKey) action = "Zoomed out";
    else if (!content.canZoomIn) action = "Already at the closest zoom";
    content.zoom(e.shiftKey ? 2 : 0.5, time);
    // Near the edges of the data, the view is shifted rather than centered on the clicked time.
    const { viewStartMs = 0, viewRangeMs = 0 } = content;
    const centered = Math.abs(viewStartMs + viewRangeMs / 2 - time.toMillis()) <= 1;
    announce(`${action}${centered ? `, centered on ${formatTime(time)}` : ""}. ${describeView(content)}`);
  };

  // Also handles a lost pointer capture, so a missed pointerup can't leave a drag running.
  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) endDrag(e);
  };

  useEffect(() => {
    if (!content.isPlacingMarker) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") content.stopPlacingMarker();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [content, content.isPlacingMarker]);

  if (readOnly) {
    return <div className="timeline-plot">{children}</div>;
  }

  const cursorClass = content.isPlacingMarker
    ? "placing"
    : isDragging ? "grabbing" : isShiftDown ? "zoom-out" : "zoom-in";

  return (
    <>
      <div
        className={classNames("timeline-plot", "interactive", cursorClass)}
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
