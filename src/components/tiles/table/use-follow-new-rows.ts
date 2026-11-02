import { RefObject, useEffect, useRef } from "react";
import { DataGridHandle } from "react-data-grid";

// How close to the bottom still counts as "following". A couple of pixels of slack absorbs the
// fractional scrollHeight browsers report at non-integer zoom, which would otherwise read as
// scrolled-away on a view the student never touched.
const kAtBottomSlackPx = 4;

/**
 * Keeps the newest row in view as rows arrive, which is what makes a Dataflow recording legible:
 * without it the points land below the fold and the table looks frozen on its first screenful.
 *
 * Only while the view is already at the bottom. A student who scrolled up to read earlier rows
 * must not be yanked back by the next recorded point, so scrolling away opts out until they
 * scroll back down.
 */
export function useFollowNewRows(gridRef: RefObject<DataGridHandle>, rowCount: number) {
  const following = useRef(true);
  const lastRowCount = useRef(rowCount);

  useEffect(() => {
    const element = gridRef.current?.element;
    if (!element) return;
    const handleScroll = () => {
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
    // Set scrollTop rather than calling the grid's scrollToCell, which also moves the selected
    // cell -- following the data must not steal a cell the student is editing.
    if (grew && following.current && element) element.scrollTop = element.scrollHeight;
  }, [gridRef, rowCount]);
}
