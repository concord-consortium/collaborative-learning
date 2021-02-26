import React, { useCallback } from "react";
import { Tooltip } from "react-tippy";
import AddColumnSvg from "../../../assets/icons/add/add.nosvgo.svg";
import RemoveRowSvg from "../../../assets/icons/remove/remove.nosvgo.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { TFormatterProps } from "./table-types";

interface IUseControlsColumn {
  readOnly?: boolean;
  onAddColumn?: () => void;
  onRemoveRow?: (rowId: string) => void;
}
export const useControlsColumn = ({ readOnly, onAddColumn, onRemoveRow }: IUseControlsColumn) => {

  const kTooltipDistance = -35; // required to get tooltip to line up just below the cell
  const addColumnTooltipOptions = useTooltipOptions({ title: "Add column", distance: kTooltipDistance });
  const ControlsHeaderRenderer: React.FC = useCallback(() => {
    return !readOnly
            ? <Tooltip {...addColumnTooltipOptions}>
                <AddColumnButton onAddColumn={onAddColumn} />
              </Tooltip>
            : null;
  }, [addColumnTooltipOptions, onAddColumn, readOnly]);

  const removeRowTooltipOptions = useTooltipOptions({ title: "Remove row", distance: kTooltipDistance });
  const ControlsRowFormatter: React.FC<TFormatterProps> = useCallback(({ rowIdx, row, isRowSelected }) => {
    const showRemoveButton = !readOnly && (isRowSelected || row.__context__.isSelectedCellInRow(rowIdx));
    return showRemoveButton
            ? <Tooltip {...removeRowTooltipOptions}>
                <RemoveRowButton rowId={row.__id__} onRemoveRow={onRemoveRow} />
              </Tooltip>
            : null;
  }, [onRemoveRow, readOnly, removeRowTooltipOptions]);
  ControlsRowFormatter.displayName = "ControlsRowFormatter";

  return { ControlsHeaderRenderer, ControlsRowFormatter };
};

interface IAddColumnButtonProps {
  onAddColumn?: () => void;
}
const AddColumnButton: React.FC<IAddColumnButtonProps> = ({ onAddColumn }) => {
  return (
    <div className="add-column-button" onClick={() => onAddColumn?.()}>
      <AddColumnSvg className="add-column-icon"/>
    </div>
  );
};
AddColumnButton.displayName = "AddColumnButton";

interface IRemoveRowButtonProps {
  rowId: string;
  onRemoveRow?: (rowId: string) => void;
}
const RemoveRowButton: React.FC<IRemoveRowButtonProps> = ({ rowId, onRemoveRow }) => {
  return (
    <div className="remove-row-button" onClick={() => onRemoveRow?.(rowId)}  data-test="remove-row-button">
      <RemoveRowSvg className="remove-row-icon"/>
    </div>
  );
};
RemoveRowButton.displayName = "RemoveRowButton";
