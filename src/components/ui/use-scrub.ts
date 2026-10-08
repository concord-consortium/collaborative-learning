import React, { RefObject, useEffect, useRef, useState } from "react";

interface IScrubDrag {
  pointerId: number;
  // Distance from the start of the view to the point under the pointer
  grabOffset: number;
  viewRange: number;
}

export interface IUseScrubOptions {
  /** The element whose width spans `totalStart` to `totalEnd`; attach the returned handlers to it. */
  trackRef: RefObject<HTMLElement>;
  /** The element that shows the view, such as a scrollbar thumb. A press on it always grabs the view. */
  handleRef: RefObject<HTMLElement>;
  totalStart: number;
  totalEnd: number;
  viewStart: number;
  viewEnd: number;
  disabled?: boolean;
  onViewChange: (start: number, end: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

/**
 * Pointer handling for moving a view along a track, as with a scrollbar. Pressing the view grabs it,
 * so the grabbed point stays under the pointer while dragging; pressing elsewhere on the track
 * centers the view there. The view stops at the ends of the track.
 */
export function useScrub({
  trackRef, handleRef, totalStart, totalEnd, viewStart, viewEnd, disabled,
  onViewChange, onScrubStart, onScrubEnd
}: IUseScrubOptions) {
  const dragRef = useRef<IScrubDrag | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // End a scrub that is still in progress when the component goes away.
  const onScrubEndRef = useRef(onScrubEnd);
  onScrubEndRef.current = onScrubEnd;
  useEffect(() => () => {
    if (dragRef.current) onScrubEndRef.current?.();
  }, []);

  const valueAtClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return undefined;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return totalStart + fraction * (totalEnd - totalStart);
  };

  const scrubTo = (value: number, drag: IScrubDrag) => {
    const start = Math.max(totalStart, Math.min(value - drag.grabOffset, totalEnd - drag.viewRange));
    onViewChange(start, start + drag.viewRange);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (disabled || e.button !== 0 || dragRef.current) return;
    const value = valueAtClientX(e.clientX);
    if (value === undefined) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const viewRange = viewEnd - viewStart;
    const grabbed = !!handleRef.current?.contains(e.target as Node) || (value >= viewStart && value <= viewEnd);
    const drag = { pointerId: e.pointerId, grabOffset: grabbed ? value - viewStart : viewRange / 2, viewRange };
    dragRef.current = drag;
    setIsScrubbing(true);
    onScrubStart?.();
    if (!grabbed) scrubTo(value, drag);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const value = valueAtClientX(e.clientX);
    if (value !== undefined) scrubTo(value, drag);
  };

  // Also handles a canceled pointer or a lost pointer capture, so a missed pointerup can't leave a
  // scrub running.
  const endScrub = (e: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsScrubbing(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onScrubEnd?.();
  };

  return {
    isScrubbing,
    trackHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endScrub,
      onPointerCancel: endScrub,
      onLostPointerCapture: endScrub
    }
  };
}
