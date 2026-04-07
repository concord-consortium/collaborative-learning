import React, { useCallback, useRef } from "react";
import { DateTime } from "luxon";
import { kMinViewRangeSeconds } from "../models/timeline-content";

import "./dynamic-scrollbar.scss";

// Keyboard step as a fraction of the data range
const kKeyboardStepFraction = 0.05;
const kKeyboardLargeStepFraction = 0.2;

interface IDynamicScrollbarProps {
  thumbAriaLabel?: string;
  dataStartTime: DateTime;
  dataEndTime: DateTime;
  viewStartTime: DateTime;
  viewEndTime: DateTime;
  onViewChange: (start: DateTime, end: DateTime) => void;
}

export const DynamicScrollbar: React.FC<IDynamicScrollbarProps> = ({
  thumbAriaLabel, dataStartTime, dataEndTime, viewStartTime, viewEndTime, onViewChange
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mouseX: number; viewStartSeconds: number } | null>(null);

  const dataRangeSeconds = Math.max(dataEndTime.diff(dataStartTime, "seconds").seconds, kMinViewRangeSeconds);
  const viewStartOffset = viewStartTime.diff(dataStartTime, "seconds").seconds;
  const viewRangeSeconds = viewEndTime.diff(viewStartTime, "seconds").seconds;

  const leftPercent = (viewStartOffset / dataRangeSeconds) * 100;
  const widthPercent = (viewRangeSeconds / dataRangeSeconds) * 100;
  const maxOffset = dataRangeSeconds - viewRangeSeconds;
  const valueNow = maxOffset > 0 ? Math.round((viewStartOffset / maxOffset) * 100) : 0;

  const shiftView = useCallback((deltaSeconds: number) => {
    let newStartSeconds = viewStartOffset + deltaSeconds;
    newStartSeconds = Math.max(0, Math.min(newStartSeconds, dataRangeSeconds - viewRangeSeconds));
    const newStart = dataStartTime.plus({ seconds: newStartSeconds });
    const newEnd = newStart.plus({ seconds: viewRangeSeconds });
    onViewChange(newStart, newEnd);
  }, [dataStartTime, dataRangeSeconds, viewRangeSeconds, viewStartOffset, onViewChange]);

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
    newStartSeconds = Math.max(0, Math.min(newStartSeconds, dataRangeSeconds - viewRangeSeconds));

    const newStart = dataStartTime.plus({ seconds: newStartSeconds });
    const newEnd = newStart.plus({ seconds: viewRangeSeconds });
    onViewChange(newStart, newEnd);
  }, [dataStartTime, dataRangeSeconds, viewRangeSeconds, onViewChange]);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        shiftView(-dataRangeSeconds * kKeyboardStepFraction);
        break;
      case "PageDown":
        e.preventDefault();
        shiftView(-dataRangeSeconds * kKeyboardLargeStepFraction);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        shiftView(dataRangeSeconds * kKeyboardStepFraction);
        break;
      case "PageUp":
        e.preventDefault();
        shiftView(dataRangeSeconds * kKeyboardLargeStepFraction);
        break;
      case "Home":
        e.preventDefault();
        shiftView(-viewStartOffset);
        break;
      case "End":
        e.preventDefault();
        shiftView(dataRangeSeconds - viewRangeSeconds - viewStartOffset);
        break;
    }
  }, [dataRangeSeconds, viewRangeSeconds, viewStartOffset, shiftView]);

  return (
    <div className="dynamic-scrollbar" ref={trackRef}>
      <div
        className="dynamic-scrollbar-thumb"
        role="slider"
        aria-label={thumbAriaLabel ?? "Scroll position"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueNow}
        tabIndex={0}
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};
