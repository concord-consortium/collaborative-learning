import React, { useCallback, useRef } from "react";
import { DateTime } from "luxon";
import { kMinViewRangeSeconds } from "../models/timeline-content";

import "./dynamic-scrollbar.scss";

interface IDynamicScrollbarProps {
  dataStartTime: DateTime;
  dataEndTime: DateTime;
  viewStartTime: DateTime;
  viewEndTime: DateTime;
  onViewChange: (start: DateTime, end: DateTime) => void;
}

export const DynamicScrollbar: React.FC<IDynamicScrollbarProps> = ({
  dataStartTime, dataEndTime, viewStartTime, viewEndTime, onViewChange
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mouseX: number; viewStartSeconds: number } | null>(null);

  const dataRangeSeconds = Math.max(dataEndTime.diff(dataStartTime, "seconds").seconds, kMinViewRangeSeconds);
  const viewStartOffset = viewStartTime.diff(dataStartTime, "seconds").seconds;
  const viewRangeSeconds = viewEndTime.diff(viewStartTime, "seconds").seconds;

  const leftPercent = (viewStartOffset / dataRangeSeconds) * 100;
  const widthPercent = (viewRangeSeconds / dataRangeSeconds) * 100;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      mouseX: e.clientX,
      viewStartSeconds: viewStartOffset
    };
  }, [viewStartOffset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !trackRef.current) return;
    const trackWidth = trackRef.current.getBoundingClientRect().width;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaSeconds = (deltaX / trackWidth) * dataRangeSeconds;

    let newStartSeconds = dragStartRef.current.viewStartSeconds + deltaSeconds;
    // Clamp so the view stays within data bounds
    newStartSeconds = Math.max(0, Math.min(newStartSeconds, dataRangeSeconds - viewRangeSeconds));

    const newStart = dataStartTime.plus({ seconds: newStartSeconds });
    const newEnd = newStart.plus({ seconds: viewRangeSeconds });
    onViewChange(newStart, newEnd);
  }, [dataStartTime, dataRangeSeconds, viewRangeSeconds, onViewChange]);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  return (
    <div className="dynamic-scrollbar" ref={trackRef}>
      <div
        className="dynamic-scrollbar-thumb"
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
};
