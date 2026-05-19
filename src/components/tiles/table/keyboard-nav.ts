/**
 * Keyboard navigation helpers for the table tile. Centralizes all logic
 * that depends on RDG beta.44 APIs so Phase 2 (React 19 / RDG main) is
 * a mechanical rename. See specs/CLUE-453-table-keyboard-navigation.md
 * §6.1 for the migration story.
 */

import type { MutableRefObject, RefObject } from "react";
import type { FocusContentContext } from "@concord-consortium/accessibility-tools/hooks";
import type { DataGridHandle } from "react-data-grid";

export type CellPosition = { idx: number; rowIdx: number };

/**
 * Returns true if document.activeElement is an editor (input/textarea/contenteditable)
 * inside an RDG body cell or header cell. Used by the Escape handler to let RDG
 * cancel the edit instead of exiting the trap.
 */
export function isCellEditing(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  const isEditable =
    active.matches("input, textarea") ||
    active.getAttribute("contenteditable") === "true";
  if (!isEditable) return false;
  return active.closest('[role="gridcell"], [role="columnheader"]') !== null;
}

/**
 * Wraps `gridRef.current.selectCell` and opts into the patched
 * `shouldFocusCell=true` third argument (added in
 * patches/react-data-grid+7.0.0-beta.44.patch, commit f71c4eb0f). We need
 * focus to land on the cell when entering the grid via focusContent.
 *
 * Phase 2 will swap to setActivePosition(position, { shouldFocus: true })
 * once we upgrade past React 18.
 */
export type BodyDeps = {
  gridRef: RefObject<DataGridHandle | null>;
  selectedCellRef: MutableRefObject<CellPosition | null>;
  columnsRef: MutableRefObject<Array<unknown>>;
  rowsRef: MutableRefObject<Array<unknown>>;
};

export function createBodyTabHandler(deps: Omit<BodyDeps, "gridRef">) {
  return (event: KeyboardEvent, reverse: boolean): "handled" | "exit" => {
    const pos = deps.selectedCellRef.current;
    if (!pos) {
      event.preventDefault();
      return "exit";
    }
    const lastCol = deps.columnsRef.current.length - 1;
    const lastRow = deps.rowsRef.current.length - 1;
    // The grid spans the header row (rowIdx === -1) and the body rows.
    // RDG's navigate() handles header↔body transitions internally; the trap
    // only intercepts at the very edges of the grid.
    const atFirst = pos.idx === 0 && pos.rowIdx === -1;
    const atLast = pos.idx === lastCol && pos.rowIdx === lastRow;
    if (reverse ? atFirst : atLast) {
      event.preventDefault();
      return "exit";
    }
    return "handled";
  };
}

export function createBodyEscapeHandler() {
  return (_event: KeyboardEvent): "handled" | "exit" => {
    if (isCellEditing()) {
      // Let RDG cancel the edit; don't preventDefault, don't exit trap.
      return "handled";
    }
    return "exit";
  };
}

export function createBodyFocusContent(deps: BodyDeps) {
  return (context: FocusContentContext): boolean => {
    const grid = deps.gridRef.current;
    if (!grid?.element) return false;
    // Per the FocusContentContext doc, treat unknown modes as forward.
    if (context.entryMode !== "reverse") {
      // Forward entry: land on the first header cell at (idx=0, rowIdx=-1).
      const headerCell = grid.element.querySelector<HTMLElement>(
        '[role="row"][aria-rowindex="1"] [role="columnheader"][aria-colindex="1"]'
      );
      if (headerCell?.getAttribute("aria-selected") === "true") {
        // Already the active position — RDG's selectCell would skip the focus
        // side-effect (samePosition), so focus the cell or its entry directly.
        focusCellOrEntry(headerCell);
      } else {
        // Different position — let RDG's layout effect handle focus after
        // selectCell updates selectedPosition.
        setGridActivePosition(deps.gridRef, { idx: 0, rowIdx: -1 });
      }
      return true;
    }
    // Reverse entry: use memory if it exists. This can be useful if the user clicks on the
    // toolbar and then shift+tabs back to get to the last position in the table.
    // It isn't clear if this memory based reverse behavior is useful.
    // Regardless it serves as a demonstration of how to use the RDG focus memory.
    const cell = grid.element.querySelector<HTMLElement>(
      '[role="row"] [role="gridcell"][tabindex="0"], [role="row"] [role="columnheader"][tabindex="0"]'
    );
    if (cell) {
      focusCellOrEntry(cell);
      return true;
    }
    // Memory missing (virtualized out, or first entry without prior nav) —
    // fall back to bottom-right.
    const lastCol = deps.columnsRef.current.length - 1;
    const lastRow = deps.rowsRef.current.length - 1;
    setGridActivePosition(deps.gridRef, { idx: lastCol, rowIdx: lastRow });
    return true;
  };
}

// Mirrors RDG's internal focusCellOrCellContent: focuses the first
// [tabindex="0"] descendant of the cell, or the cell itself.
function focusCellOrEntry(cell: HTMLElement): void {
  const inner = cell.querySelector<HTMLElement>('[tabindex="0"]');
  (inner ?? cell).focus();
}

export function setGridActivePosition(
  gridRef: RefObject<DataGridHandle | null>,
  position: CellPosition
): void {
  // The public DataGridHandle type doesn't yet expose the third arg, but the
  // patched implementation accepts it. Cast to call.
  (gridRef.current as unknown as {
    selectCell: (pos: CellPosition, enableEditor?: boolean, shouldFocusCell?: boolean) => void;
  } | null)?.selectCell(position, undefined, true);
}
