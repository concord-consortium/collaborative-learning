import { RefObject, useEffect, useRef } from "react";
import { DataGridHandle } from "react-data-grid";

// How close to the bottom still counts as "following". A couple of pixels of slack absorbs the
// fractional scrollHeight browsers report at non-integer zoom, which would otherwise read as
// scrolled-away on a view the student never touched.
const kAtBottomSlackPx = 4;

// Rows arriving closer together than this are scrolled instantly. A smooth scroll takes a few
// hundred ms, so at a fast sampling rate the animation never finishes before the next row lands:
// the view would fall behind, and the scroll events from the unfinished animation would read as
// the student scrolling away. Instant lands exactly at the bottom every time.
const kSmoothMinIntervalMs = 400;

// Beyond this a smooth scroll crawls rather than reading as motion, so jump instead. Reached when
// several rows arrive at once -- a bulk load, or an undo.
const kSmoothMaxDistancePx = 240;

// How long to treat scroll events as our own after starting a smooth scroll. Comfortably longer
// than a browser's animation for a row-sized distance.
const kAnimationWindowMs = 500;

/** Honors the OS setting. matchMedia is absent under jsdom, hence the optional call. */
function prefersReducedMotion() {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Keeps the newest row in view as rows arrive, which is what makes a Dataflow recording legible:
 * without it the points land below the fold and the table looks frozen on its first screenful.
 *
 * Scrolls smoothly where it can, so the rows visibly move up rather than teleporting — an
 * instantaneous jump is hard to read as "a new row arrived".
 *
 * Only follows while the view is already at the bottom. A student who scrolled up to read earlier
 * rows must not be yanked back by the next recorded point, so scrolling away opts out until they
 * scroll back down.
 */
export function useFollowNewRows(gridRef: RefObject<DataGridHandle>, rowCount: number) {
  const following = useRef(true);
  const lastRowCount = useRef(rowCount);
  const lastRowAt = useRef(0);
  const animatingUntil = useRef(0);

  useEffect(() => {
    const element = gridRef.current?.element;
    if (!element) return;
    const handleScroll = () => {
      // Ignore the events our own smooth scroll emits. They report positions short of the bottom,
      // which would read as the student scrolling away -- and if a row arrived mid-animation the
      // hook would stop following for good, leaving exactly the frozen table it exists to prevent.
      if (Date.now() < animatingUntil.current) return;
      following.current =
        element.scrollHeight - element.scrollTop - element.clientHeight <= kAtBottomSlackPx;
    };
    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [gridRef]);

  useEffect(() => {
    const grew = rowCount > lastRowCount.current;
    lastRowCount.current = rowCount;
    const element = gridRef.current?.element;
    if (!grew || !following.current || !element) return;

    const now = Date.now();
    const rapid = now - lastRowAt.current < kSmoothMinIntervalMs;
    lastRowAt.current = now;

    const top = element.scrollHeight;
    const distance = top - element.scrollTop - element.clientHeight;
    const smooth = !rapid && !prefersReducedMotion() && distance <= kSmoothMaxDistancePx;

    // A row arriving mid-animation re-issues this, which retargets the animation at the new bottom
    // rather than leaving it to finish one row short.
    animatingUntil.current = smooth ? now + kAnimationWindowMs : 0;

    // scrollTo rather than the grid's scrollToCell, which also moves the selected cell -- following
    // the data must not steal a cell the student is editing.
    element.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }, [gridRef, rowCount]);
}
