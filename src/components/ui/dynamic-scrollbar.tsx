import classNames from "classnames";
import React, { useCallback, useRef } from "react";
import { useScrub } from "./use-scrub";

import "./dynamic-scrollbar.scss";

// Keyboard step as a fraction of the data range
const kKeyboardStepFraction = 0.05;
const kKeyboardLargeStepFraction = 0.2;
const kDefaultMinViewRange = 100;

interface IDynamicScrollbarProps {
  thumbAriaLabel?: string;
  totalStart: number;
  totalEnd: number;
  viewStart: number;
  viewEnd: number;
  minViewRange?: number;
  disabled?: boolean;
  onViewChange: (start: number, end: number) => void;
  /** Called when a press on the track begins dragging the view, e.g. to group its changes. */
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export const DynamicScrollbar: React.FC<IDynamicScrollbarProps> = ({
  thumbAriaLabel, totalStart, totalEnd, viewStart, viewEnd, minViewRange = kDefaultMinViewRange, disabled,
  onViewChange, onScrubStart, onScrubEnd
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const totalRange = Math.max(totalEnd - totalStart, minViewRange);
  const viewStartOffset = viewStart - totalStart;
  const viewRange = viewEnd - viewStart;

  const leftPercent = (viewStartOffset / totalRange) * 100;
  const widthPercent = (viewRange / totalRange) * 100;
  const maxOffset = totalRange - viewRange;
  const valueNow = maxOffset > 0 ? Math.round((viewStartOffset / maxOffset) * 100) : 0;

  const shiftView = useCallback((delta: number) => {
    let newStartOffset = viewStartOffset + delta;
    newStartOffset = Math.max(0, Math.min(newStartOffset, totalRange - viewRange));
    const newStart = totalStart + newStartOffset;
    const newEnd = newStart + viewRange;
    onViewChange(newStart, newEnd);
  }, [totalStart, totalRange, viewRange, viewStartOffset, onViewChange]);

  const { isScrubbing, trackHandlers } = useScrub({
    trackRef, handleRef: thumbRef, totalStart, totalEnd: totalStart + totalRange, viewStart, viewEnd, disabled,
    onViewChange, onScrubStart, onScrubEnd
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        shiftView(-totalRange * kKeyboardStepFraction);
        break;
      case "PageDown":
        e.preventDefault();
        shiftView(-totalRange * kKeyboardLargeStepFraction);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        shiftView(totalRange * kKeyboardStepFraction);
        break;
      case "PageUp":
        e.preventDefault();
        shiftView(totalRange * kKeyboardLargeStepFraction);
        break;
      case "Home":
        e.preventDefault();
        shiftView(-viewStartOffset);
        break;
      case "End":
        e.preventDefault();
        shiftView(totalRange - viewRange - viewStartOffset);
        break;
    }
  }, [disabled, totalRange, viewRange, viewStartOffset, shiftView]);

  return (
    <div
      className={classNames("dynamic-scrollbar", { disabled, "is-scrubbing": isScrubbing })}
      ref={trackRef}
      {...trackHandlers}
    >
      <div
        ref={thumbRef}
        className="dynamic-scrollbar-thumb"
        role="slider"
        aria-label={thumbAriaLabel ?? "Scroll position"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueNow}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};
