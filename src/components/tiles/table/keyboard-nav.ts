/**
 * Keyboard navigation helpers for the table tile. Centralizes all logic
 * that depends on RDG beta.44 APIs so Phase 2 (React 19 / RDG main) is
 * a mechanical rename. See specs/CLUE-453-table-keyboard-navigation.md
 * §6.1 for the migration story.
 */

import type { MutableRefObject, RefObject } from "react";
import type { DataGridHandle } from "react-data-grid";

export type CellPosition = { idx: number; rowIdx: number };

/** Returns true if document.activeElement is a text input inside an RDG cell. */
export function isCellEditing(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  const isEditable =
    active.matches("input, textarea") ||
    active.getAttribute("contenteditable") === "true";
  if (!isEditable) return false;
  return active.closest('[role="gridcell"]') !== null;
}

/**
 * Returns all focusable header controls in DOM order. Includes elements with
 * tabindex="-1" because the header uses roving tabindex — only one focusable
 * has tabindex="0" at a time, but the others are still in the navigation
 * cycle for our custom Tab handler.
 */
export function getHeaderFocusables(headerEl: HTMLElement): HTMLElement[] {
  const candidates = Array.from(
    headerEl.querySelectorAll<HTMLElement>(
      'button, [contenteditable="true"], [tabindex]'
    )
  );
  return candidates.filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    return true;
  });
}

/**
 * Wraps `gridRef.current.selectCell` and opts into the patched
 * `shouldFocusCell=true` third argument (added in
 * patches/react-data-grid+7.0.0-beta.44.patch, commit f71c4eb0f). We need
 * focus to land on the cell when entering the content slot via focusContent.
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
    const atFirst = pos.idx === 0 && pos.rowIdx === 0;
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
  return (context: { reverse: boolean }): boolean => {
    const grid = deps.gridRef.current;
    if (!grid?.element) return false;
    if (!context.reverse) {
      setGridActivePosition(deps.gridRef, { idx: 0, rowIdx: 0 });
      return true;
    }
    // Reverse entry — use RDG's tabindex=0 cell as the memory cursor.
    // Exclude header row (aria-rowindex="1").
    const cell = grid.element.querySelector<HTMLElement>(
      '[role="row"]:not([aria-rowindex="1"]) [role="gridcell"][tabindex="0"]'
    );
    if (cell) {
      cell.focus();
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

export function createHeaderTabHandler(deps: {
  getTopbarElement: () => HTMLElement | undefined;
}) {
  return (event: KeyboardEvent, reverse: boolean): "handled" | "exit" => {
    const headerEl = deps.getTopbarElement();
    if (!headerEl) {
      event.preventDefault();
      return "exit";
    }
    const focusables = getHeaderFocusables(headerEl);
    const currentIdx = focusables.indexOf(document.activeElement as HTMLElement);
    if (currentIdx === -1) {
      event.preventDefault();
      return "exit";
    }
    const nextIdx = reverse ? currentIdx - 1 : currentIdx + 1;
    if (nextIdx < 0 || nextIdx >= focusables.length) {
      event.preventDefault();
      return "exit";
    }
    event.preventDefault();
    focusables[currentIdx].setAttribute("tabindex", "-1");
    focusables[nextIdx].setAttribute("tabindex", "0");
    focusables[nextIdx].focus();
    return "handled";
  };
}

export function createHeaderEscapeHandler() {
  return (_event: KeyboardEvent): "handled" | "exit" => {
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement &&
      active.closest(".editable-header-cell")
    ) {
      // Let HeaderCellInput handle Escape (calls onClose with cancel).
      return "handled";
    }
    return "exit";
  };
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
