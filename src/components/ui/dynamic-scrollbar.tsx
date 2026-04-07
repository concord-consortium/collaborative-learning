import React, { useCallback, useRef } from "react";
import { DateTime } from "luxon";
import { kMinViewRangeSeconds } from "../../plugins/timeline/models/timeline-content";

import "./dynamic-scrollbar.scss";

// Keyboard step as a fraction of the data range
const kKeyboardStepFraction = 0.05;
const kKeyboardLargeStepFraction = 0.2;

interface IDynamicScrollbarProps {
  thumbAriaLabel?: string;
  totalStartTime: DateTime;
  totalEndTime: DateTime;
  viewStartTime: DateTime;
  viewEndTime: DateTime;
  onViewChange: (start: DateTime, end: DateTime) => void;
}

export const DynamicScrollbar: React.FC<IDynamicScrollbarProps> = ({
  thumbAriaLabel, totalStartTime, totalEndTime, viewStartTime, viewEndTime, onViewChange
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mouseX: number; viewStartSeconds: number } | null>(null);

  const totalRangeSeconds = Math.max(totalEndTime.diff(totalStartTime, "seconds").seconds, kMinViewRangeSeconds);
  const viewStartOffset = viewStartTime.diff(totalStartTime, "seconds").seconds;
  const viewRangeSeconds = viewEndTime.diff(viewStartTime, "seconds").seconds;

  const leftPercent = (viewStartOffset / totalRangeSeconds) * 100;
  const widthPercent = (viewRangeSeconds / totalRangeSeconds) * 100;
  const maxOffset = totalRangeSeconds - viewRangeSeconds;
  const valueNow = maxOffset > 0 ? Math.round((viewStartOffset / maxOffset) * 100) : 0;

  const shiftView = useCallback((deltaSeconds: number) => {
    let newStartSeconds = viewStartOffset + deltaSeconds;
    newStartSeconds = Math.max(0, Math.min(newStartSeconds, totalRangeSeconds - viewRangeSeconds));
    const newStart = totalStartTime.plus({ seconds: newStartSeconds });
    const newEnd = newStart.plus({ seconds: viewRangeSeconds });
    onViewChange(newStart, newEnd);
  }, [totalStartTime, totalRangeSeconds, viewRangeSeconds, viewStartOffset, onViewChange]);

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
    const deltaSeconds = (deltaX / trackWidth) * totalRangeSeconds;

    let newStartSeconds = dragStartRef.current.viewStartSeconds + deltaSeconds;
    newStartSeconds = Math.max(0, Math.min(newStartSeconds, totalRangeSeconds - viewRangeSeconds));

    const newStart = totalStartTime.plus({ seconds: newStartSeconds });
    const newEnd = newStart.plus({ seconds: viewRangeSeconds });
    onViewChange(newStart, newEnd);
  }, [totalStartTime, totalRangeSeconds, viewRangeSeconds, onViewChange]);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        shiftView(-totalRangeSeconds * kKeyboardStepFraction);
        break;
      case "PageDown":
        e.preventDefault();
        shiftView(-totalRangeSeconds * kKeyboardLargeStepFraction);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        shiftView(totalRangeSeconds * kKeyboardStepFraction);
        break;
      case "PageUp":
        e.preventDefault();
        shiftView(totalRangeSeconds * kKeyboardLargeStepFraction);
        break;
      case "Home":
        e.preventDefault();
        shiftView(-viewStartOffset);
        break;
      case "End":
        e.preventDefault();
        shiftView(totalRangeSeconds - viewRangeSeconds - viewStartOffset);
        break;
    }
  }, [totalRangeSeconds, viewRangeSeconds, viewStartOffset, shiftView]);

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
