import { useEffect } from "react";
import { IHighlightBox } from "./highlight-registry-context";

const kMaxRafAttempts = 120; // ~2 seconds at 60fps

/**
 * Returns the chip's bbox in coordinates relative to its `.text-tool-wrapper`, in
 * layout (pre-transform) pixels — the coordinate system the annotation layer combines
 * with tile offsets. `getBoundingClientRect` returns viewport pixels, so we divide the
 * wrapper-relative delta by the wrapper's effective CSS scale to get layout coords.
 *
 * @param chipEl - The chip's DOM element.
 * @param shrinkBy - Pixels to subtract from width/height (a small visual inset so the
 *                   sparrow doesn't touch the chip's edge directly).
 * @returns The bbox, or `undefined` if the chip or wrapper hasn't been laid out.
 */
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
  if (!Number.isFinite(scale) || scale <= 0) return undefined;
  return {
    left: (chipRect.left - wrapperRect.left) / scale,
    top: (chipRect.top - wrapperRect.top) / scale,
    width: Math.max(0, chipRect.width - shrinkBy) / scale,
    height: Math.max(0, chipRect.height - shrinkBy) / scale
  };
}

/**
 * Wires up chip-measurement: initial measure, rAF retry until the chip has non-zero
 * dimensions (covers remounts into containers whose layout settles after first paint,
 * like 4-up cells and scaled thumbnails), and a `ResizeObserver` on the chip and its
 * `.text-tool-wrapper` ancestor (the wrapper catches container-driven reflows that
 * don't resize the chip's own inline box).
 *
 * Takes the chip element directly rather than a ref so the effect re-runs when the
 * element appears or changes — refs are stable across renders even when `.current`
 * updates, so a conditionally-rendered chip wouldn't otherwise be measured. Callers
 * drive this with a `useState` + callback ref pattern.
 *
 * @param chipEl - The chip's DOM element, or `null` while it isn't mounted.
 * @param measure - Caller's bbox-publishing callback; responsible for its own zero-
 *                  size guard.
 * @param trigger - Optional extra dependency that forces a re-run when its value
 *                  changes (used by highlights to re-measure on Slate revision changes).
 */
export function useChipMeasurement(
  chipEl: HTMLElement | null,
  measure: () => void,
  trigger?: unknown
) {
  useEffect(() => {
    if (!chipEl) return;
    const wrapperEl = chipEl.closest('.text-tool-wrapper');

    measure();

    let rafId = 0;
    let attempts = 0;
    const retryIfZero = () => {
      const rect = chipEl.getBoundingClientRect();
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
    resizeObs.observe(chipEl);
    if (wrapperEl) resizeObs.observe(wrapperEl);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObs.disconnect();
    };
  }, [chipEl, measure, trigger]);
}
