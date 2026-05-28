import React, { useCallback } from "react";
import { useRowSelection } from "react-data-grid";
import { Tooltip } from "react-tippy";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import RowLabelsHiddenSvg from "../../../clue/assets/icons/table/row-labels-hidden-icon.svg";
import RowLabelsShownSvg from "../../../clue/assets/icons/table/row-labels-shown-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { TFormatterProps, TRow, kHeaderRowHeight } from "./table-types";
import { RowDivider } from "./row-divider";
import DragIndicator from "../../../clue/assets/icons/table/row-drag-indicator.svg";

export const kTableRowDividerHeight = 9;
export const kTableDividerOffset = Math.ceil(kTableRowDividerHeight / 2);

// Defined at module level so the component's identity is stable across
// RowLabelFormatter calls. If this were declared inline inside RowLabelFormatter
// React would see a new component class every call and unmount + remount the
// wrapper DOM on each cell render — losing focus, churning event listeners,
// and (under cypress, which dispatches `click` events via `dispatchEvent`
// rather than as the natural follow-up to pointerdown) leaving the click's
// `e.target` referring to an orphaned node so it falls through to `.rdg`.
interface IDraggableRowLabelProps {
  row: TRow;
  // RDG passes a tabIndex via RenderCellProps that is 0 for the cell at the
  // current selectedPosition and -1 for all others. We thread it onto the
  // .index-cell-contents element so RDG's focusCellOrCellContent — which does
  // `cell.querySelector('[tabindex="0"]') ?? cell` — focuses our element when
  // this cell is selected. Otherwise focus lands on the .rdg-cell parent and
  // our onKeyDown handler never fires (keys bubble up *from* the parent, not
  // through us).
  tabIndex: number;
  inputRowId: string;
  showRowLabels: boolean;
  dragOverRowId?: string | null;
  setHoveredRowId: (rowId: string | null) => void;
  setDragOverRowId: (rowId: string | null) => void;
  gridElement?: HTMLDivElement | null;
  rowHeight: (args: any) => number;
}

const DraggableRowLabel: React.FC<IDraggableRowLabelProps> = ({
  row, tabIndex, inputRowId, showRowLabels, dragOverRowId,
  setHoveredRowId, setDragOverRowId, gridElement, rowHeight
}) => {
  const { __id__, __index__, __context__ } = row;
  const rowHeightValue = rowHeight({ row, type: "ROW" });
  // RenderCellProps doesn't expose isRowSelected/onRowSelectionChange; useRowSelection()
  // reads them from row context inside the cell renderer.
  const [isRowSelected, onRowSelectionChange] = useRowSelection();
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: __id__ });
  const isInputRow = __id__ === inputRowId;
  const rowTop = __index__ ? (__index__ - 1) * rowHeight({ row, type: "ROW" }) + kHeaderRowHeight : 0;

  // Row-selection logic, callable from both pointerdown (mouse / touch) and
  // keydown (Enter / Space). Modifiers (shift / ctrl / meta) route through
  // RDG's onRowSelectionChange for range-select and toggle; a plain activation
  // selects a single row (or clears selection for the input row).
  const performRowSelect = (mods: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
    const hasModifier = mods.ctrlKey || mods.metaKey || mods.shiftKey;
    const selected = hasModifier ? !isRowSelected : true;
    if (selected === isRowSelected) return;
    if (hasModifier) {
      onRowSelectionChange({ type: "ROW", row, checked: selected, isShiftClick: mods.shiftKey });
    } else if (__id__ === inputRowId) {
      __context__.onClearSelection({ cell: false });
    } else {
      __context__.onSelectOneRow(__id__);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    performRowSelect(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter or Space activates the index cell the same way a click would.
    // RDG would otherwise treat these keys for cell-edit (Enter) or selection
    // (Space), neither of which is meaningful on the index column.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      performRowSelect(e);
    }
  };

  return (
    <div className="index-cell-wrapper"
      // Row-select on pointerdown rather than click. dnd-kit's PointerSensor
      // is wired to the .index-cell-contents child (for row drag); pairing
      // selection with pointerdown keeps the gesture responsive even when the
      // pointer never produces a separate click event.
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onPointerOver={() => setHoveredRowId(__id__)}
      onPointerLeave={() => setHoveredRowId(null)}>
      { (__index__ === 1 && gridElement) &&
        createPortal(
          <RowDivider rowId={__id__} before={true} dragOverRowId={dragOverRowId} setDragOverRowId={setDragOverRowId}
                      topPosition={rowTop - 5} gridElement={gridElement}/>
          , gridElement)
      }
      <div className="index-cell-contents" ref={setDragRef}
        {...(!isInputRow ? { ...attributes, ...listeners } : {})}
        // `.index-cell-contents` is the keyboard-focusable element in the cell
        // and Enter/Space activates row selection — semantically a toggle
        // button (or a one-shot button on the input row, which clears selection).
        role="button"
        aria-label={isInputRow ? "Deselect rows and cells" : `Select row ${__index__}`}
        aria-pressed={!isInputRow ? isRowSelected : undefined}
        tabIndex={tabIndex}>
        {/* Always render the drag indicator for non-input rows; CSS controls visibility
            via `:hover` on .index-cell-wrapper (default opacity 0, hover opacity 0.35).
            A JS-side conditional on hoveredRowId here would fight the CSS — when the
            pointer leaves the wrapper, the JS state cleared via onPointerLeave would
            remove the icon from the DOM entirely, breaking any assertion that expects
            the element to exist with opacity 0 (the natural "hidden" state). */}
        {!isInputRow &&
          <DragIndicator className="row-drag-icon" data-testid="row-drag-indicator" />
        }
        {showRowLabels ? <span className="row-index-label">{__index__}</span> : undefined}
      </div>
      {(gridElement && !isInputRow) &&
        createPortal(
          <RowDivider rowId={__id__} setDragOverRowId={setDragOverRowId}
                      topPosition={rowTop + rowHeightValue - kTableDividerOffset}
                      gridElement={gridElement}/>
          , gridElement
        )
      }
    </div>
  );
};
DraggableRowLabel.displayName = "DraggableRowLabel";
interface IProps {
  inputRowId: string;
  showRowLabels: boolean;
  dragOverRowId?: string | null;
  setShowRowLabels: (show: boolean) => void;
  setHoveredRowId: (rowId: string | null) => void;
  setDragOverRowId: (rowId: string | null) => void;
  gridElement?: HTMLDivElement | null;
  rowHeight: (args: any) => number;
}

export const useRowLabelColumn = ({inputRowId, showRowLabels, setShowRowLabels, setHoveredRowId,
                dragOverRowId, setDragOverRowId, gridElement, rowHeight}: IProps) => {
  const title = showRowLabels ? "Hide labels" : "Show labels";
  const tooltipOptions = useTooltipOptions({ title, distance: -2 });

  const RowLabelHeader: React.FC<{ tabIndex?: number }> = useCallback(({ tabIndex }) => {
    return (
      <Tooltip {...tooltipOptions}>
        <button type="button"
              className={`show-hide-row-labels-button ${showRowLabels ? "shown" : "hidden"}`}
              aria-label={title}
              aria-pressed={showRowLabels}
              tabIndex={tabIndex ?? -1}
              onClick={(e) => {
                e.stopPropagation();
                setShowRowLabels(!showRowLabels);
              }}>
          <RowLabelsShownSvg className="hide-row-labels-icon"/>
          <RowLabelsHiddenSvg className="show-row-labels-icon"/>
        </button>
      </Tooltip>
    );
  }, [setShowRowLabels, showRowLabels, title, tooltipOptions]);
  RowLabelHeader.displayName = "RowLabelHeader";

  const RowLabelFormatter: React.FC<TFormatterProps> = useCallback(({ row, tabIndex }: TFormatterProps) => {
    return (
      <DraggableRowLabel
        row={row}
        tabIndex={tabIndex}
        inputRowId={inputRowId}
        showRowLabels={showRowLabels}
        dragOverRowId={dragOverRowId}
        setHoveredRowId={setHoveredRowId}
        setDragOverRowId={setDragOverRowId}
        gridElement={gridElement}
        rowHeight={rowHeight}
      />
    );
  }, [inputRowId, setDragOverRowId, setHoveredRowId, showRowLabels, dragOverRowId,
      gridElement, rowHeight
    ]);

  return { RowLabelHeader, RowLabelFormatter };
};
