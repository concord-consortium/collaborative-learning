import { RefObject, useEffect } from "react";
import { IHighlightBox } from "./highlight-registry-context";

const kMaxRafAttempts = 120; // ~2 seconds at 60fps

// Returns the chip's bbox in coordinates relative to its `.text-tool-wrapper`, in
// layout (pre-transform) pixels — the coordinate system the annotation layer combines
// with tile offsets. getBoundingClientRect returns viewport pixels, so we divide the
// wrapper-relative delta by the wrapper's effective CSS scale to get layout coords.
// Returns undefined if the chip or wrapper hasn't been laid out.
export function getChipBoxInWrapperCoords(
  chipEl: HTMLElement,
  shrinkBy: number
): IHighlightBox | undefined {
  const wrapperEl = chipEl.closest(".text-tool-wrapper") as HTMLElement | null;
  if (!wrapperEl || !wrapperEl.offsetWidth) return undefined;
  const chipRect = chipEl.getBoundingClientRect();
  if (chipRect.width <= 0 || chipRect.height <= 0) return undefined;
  const wrapperRect = wrapperEl.getBoundingClientRect();
  const scale = wrapperRect.width / wrapperEl.offsetWidth;
  return {
    left: (chipRect.left - wrapperRect.left) / scale,
    top: (chipRect.top - wrapperRect.top) / scale,
    width: (chipRect.width - shrinkBy) / scale,
    height: (chipRect.height - shrinkBy) / scale
  };
}

// Wires up chip-measurement: initial measure, rAF retry until the chip has non-zero
// dimensions (covers remounts into containers whose layout settles after first paint,
// like 4-up cells and scaled thumbnails), and a ResizeObserver on the chip and its
// `.text-tool-wrapper` ancestor (the wrapper catches container-driven reflows that
// don't resize the chip's own inline box).
//
// `measure` is the caller's bbox-publishing callback; it's responsible for its own
// zero-size guard. `trigger` is an optional extra dependency that forces a re-run when
// its value changes (used by highlights to re-measure on Slate revision changes).
export function useChipMeasurement(
  chipRef: RefObject<HTMLElement | null>,
  measure: () => void,
  trigger?: unknown
) {
  useEffect(() => {
    const el = chipRef.current;
    if (!el) return;
    const wrapperEl = el.closest('.text-tool-wrapper');

    measure();

    let rafId = 0;
    let attempts = 0;
    const retryIfZero = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return;
      attempts++;
      if (attempts >= kMaxRafAttempts) return;
      rafId = requestAnimationFrame(() => {
        measure();
        retryIfZero();
      });
    };
    retryIfZero();

    const resizeObs = new ResizeObserver(measure);
    resizeObs.observe(el);
    if (wrapperEl) resizeObs.observe(wrapperEl);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObs.disconnect();
    };
  }, [chipRef, measure, trigger]);
}
