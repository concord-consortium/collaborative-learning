import React, { useCallback, useEffect } from "react";
import { Tooltip } from "react-tippy";
import AddColumnSvg from "../../../assets/icons/add/add.nosvgo.svg";
import RemoveRowSvg from "../../../assets/icons/remove/remove.nosvgo.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { TColumn, TFormatterProps } from "./table-types";

interface IUseControlsColumn {
  controlsColumn?: TColumn;
  readOnly?: boolean;
  onAddColumn?: () => void;
  onRemoveRows: (rowIds: string[]) => void;
  triggerColumnChange: () => void;
}
export const useControlsColumn = ({
  controlsColumn, readOnly, onAddColumn, onRemoveRows, triggerColumnChange
}: IUseControlsColumn) => {
  const onRemoveRow = useCallback((rowId: string) => onRemoveRows([rowId]), [onRemoveRows]);

  const kTooltipDistance = -35; // required to get tooltip to line up just below the cell
  const addColumnTooltipOptions = useTooltipOptions({ title: "Add column", distance: kTooltipDistance });
  const ControlsHeaderRenderer: React.FC<{ tabIndex?: number }> = useCallback(({ tabIndex }) => {
    return !readOnly
            ? <Tooltip {...addColumnTooltipOptions}>
                <AddColumnButton onAddColumn={onAddColumn} tabIndex={tabIndex ?? -1} />
              </Tooltip>
            : null;
  }, [addColumnTooltipOptions, onAddColumn, readOnly]);

  const removeRowTooltipOptions = useTooltipOptions({ title: "Remove row", distance: kTooltipDistance });
  // RenderCellProps doesn't expose isRowSelected, so we read selection state from the
  // row's own context (a selected row always has a selected cell in it).
  const ControlsRowFormatter: React.FC<TFormatterProps> = useCallback(({ rowIdx, row, tabIndex }) => {
    // The visibility of the remove button is also controlled by CSS based on whether the
    // tile is selected or not.
    const showRemoveButton = !readOnly && (row.__context__.isSelectedCaseInRow(rowIdx) || tabIndex === 0);
    return showRemoveButton
            ? <Tooltip {...removeRowTooltipOptions}>
                <RemoveRowButton rowId={row.__id__} onRemoveRow={onRemoveRow} tabIndex={tabIndex} />
              </Tooltip>
            : null;
  }, [onRemoveRow, readOnly, removeRowTooltipOptions]);
  ControlsRowFormatter.displayName = "ControlsRowFormatter";

  useEffect(() => {
    if (controlsColumn) {
      // Column.renderHeaderCell / renderCell are readonly. We mutate them here
      // because controlsColumn is created in a sibling hook before these renderers are known.
      // The cast allows us to use this initialize-then-attach pattern.
      // If RDG ever enforces the readonly contract (e.g. freezes columns), this would
      // fail at runtime rather than silently — we'd notice it immediately.
      const mutableColumn = controlsColumn as { -readonly [K in keyof TColumn]: TColumn[K] };
      mutableColumn.renderHeaderCell = ControlsHeaderRenderer;
      mutableColumn.renderCell = ControlsRowFormatter;
      triggerColumnChange();
    }
  }, [controlsColumn, ControlsHeaderRenderer, ControlsRowFormatter, triggerColumnChange]);
};

interface IAddColumnButtonProps {
  onAddColumn?: () => void;
  tabIndex?: number;
}
const AddColumnButton: React.FC<IAddColumnButtonProps> = ({ onAddColumn, tabIndex }) => {
  // Stop propagation so the click doesn't bubble to the RDG cell wrapper. RDG's
  // cell onClick calls selectCell on whatever cell was clicked; if it ran here
  // it would select this header cell, then the synchronous onAddColumn would
  // splice a new column in before the controls column. RDG's selectedPosition
  // is positional (idx, not key), so the same idx now points to the new data
  // column — RDG ends up showing aria-selected on it. Keeping the event from
  // reaching RDG leaves both RDG's selectedPosition and dataSet selection
  // unchanged, which matches the user intent (add a column, change nothing
  // about what's selected).
  //
  // Two known residual mismatches we accept for now:
  //
  // - Mouse click with prior selection: the browser focuses the button, so
  //   the focused element ends up in the controls cell while RDG's
  //   selectedPosition stays on the previously-selected cell. Verified
  //   benign: Tab from this state advances from RDG's selectedPosition (the
  //   prior cell), which matches what a user navigating the table expects.
  //
  // - Keyboard activation (Enter on the focused button): RDG's
  //   selectedPosition was already on the controls cell before the click
  //   (that's how the user reached the button via roving). The splice shifts
  //   the controls cell to a new idx, but RDG's positional selectedPosition
  //   stays put — so aria-selected lands on the new data column even though
  //   we never ran selectCell. DataSet selection is correctly empty, so
  //   the two are out of sync until the next interaction (any click or
  //   arrow keystroke re-syncs).
  return (
    <button
      type="button"
      className="add-column-button"
      aria-label="Add column"
      tabIndex={tabIndex ?? -1}
      onClick={(e) => { e.stopPropagation(); onAddColumn?.(); }}
    >
      <AddColumnSvg className="add-column-icon"/>
    </button>
  );
};
AddColumnButton.displayName = "AddColumnButton";

interface IRemoveRowButtonProps {
  rowId: string;
  onRemoveRow?: (rowId: string) => void;
  tabIndex?: number;
}
const RemoveRowButton: React.FC<IRemoveRowButtonProps> = ({ rowId, onRemoveRow, tabIndex }) => {
  return (
    <button
      type="button"
      className="remove-row-button"
      aria-label="Remove row"
      tabIndex={tabIndex ?? -1}
      onClick={() => onRemoveRow?.(rowId)}
      data-test="remove-row-button"
    >
      <RemoveRowSvg className="remove-row-icon"/>
    </button>
  );
};
RemoveRowButton.displayName = "RemoveRowButton";
