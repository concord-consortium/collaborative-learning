import React, { useCallback, useRef } from "react";

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
  onViewChange: (start: number, end: number) => void;
}

export const DynamicScrollbar: React.FC<IDynamicScrollbarProps> = ({
  thumbAriaLabel, totalStart, totalEnd, viewStart, viewEnd, minViewRange = kDefaultMinViewRange, onViewChange
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mouseX: number; viewStartOffset: number } | null>(null);

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

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      mouseX: e.clientX,
      viewStartOffset
    };
  }, [viewStartOffset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !trackRef.current) return;
    const trackWidth = trackRef.current.getBoundingClientRect().width;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const delta = (deltaX / trackWidth) * totalRange;

    let newStartOffset = dragStartRef.current.viewStartOffset + delta;
    newStartOffset = Math.max(0, Math.min(newStartOffset, totalRange - viewRange));

    const newStart = totalStart + newStartOffset;
    const newEnd = newStart + viewRange;
    onViewChange(newStart, newEnd);
  }, [totalStart, totalRange, viewRange, onViewChange]);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [totalRange, viewRange, viewStartOffset, shiftView]);

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
