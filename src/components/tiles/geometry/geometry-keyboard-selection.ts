import { GeometryContentModelType } from "../../../models/tiles/geometry/geometry-content";
import {
  isCircle, isInfiniteLine, isMovableLine, isPoint, isPolygon,
} from "../../../models/tiles/geometry/jxg-types";

export interface SelectFocusedOptions {
  /** Shift+Return / Shift+Space — union the new selection onto the current one. */
  extend: boolean;
  /** Read-only tiles never mutate selection. */
  readOnly?: boolean;
}

/**
 * Toggles selection of the focused board object (identified by its
 * data-object-id attribute). Compound shapes select alongside their defining
 * points so arrow-key nudge (which acts on selected points) moves the shape.
 * Returns false when there's no focused geometry object to act on.
 */
export function selectFocusedGeometryObject(
  board: JXG.Board,
  content: GeometryContentModelType,
  options: SelectFocusedOptions,
): boolean {
  if (options.readOnly) return false;
  const focused = document.activeElement as Element | null;
  if (!focused) return false;
  const objectId = focused.getAttribute("data-object-id");
  if (!objectId) return false;
  const elt = board.objects[objectId] as JXG.GeometryElement | undefined;
  if (!elt) return false;

  const ids = selectionIdsFor(elt);
  if (options.extend) {
    content.selectObjects(board, ids);
  } else {
    // Toggle: if any id is already selected, deselect the whole set; else replace.
    const anyAlreadySelected = ids.some(id => content.isSelected(id));
    if (anyAlreadySelected) {
      content.deselectObjects(board, ids);
    } else {
      content.deselectAll(board);
      content.selectObjects(board, ids);
    }
  }
  return true;
}

/** Mirrors mouse handlers' ancestors-based selection so keyboard and mouse share semantics. */
function selectionIdsFor(elt: JXG.GeometryElement): string[] {
  if (isPolygon(elt) || isCircle(elt) || isInfiniteLine(elt) || isMovableLine(elt)) {
    const ancestorPointIds = Object.values(elt.ancestors)
      .filter(isPoint)
      .map(obj => obj.id);
    return [...ancestorPointIds, elt.id];
  }
  return [elt.id];
}
