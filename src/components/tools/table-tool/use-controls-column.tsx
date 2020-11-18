import React, { useCallback } from "react";
import AddColumnSvg from "../../../assets/icons/add/add.nosvgo.svg";
import RemoveRowSvg from "../../../assets/icons/remove/remove.nosvgo.svg";
import { TFormatterProps } from "./grid-types";

interface IUseControlsColumn {
  readOnly?: boolean;
  onAddColumn?: () => void;
  onRemoveRow?: (rowId: string) => void;
}
export const useControlsColumn = ({ readOnly, onAddColumn, onRemoveRow }: IUseControlsColumn) => {

  const ControlsHeaderRenderer: React.FC = useCallback(() => {
    return !readOnly
            ? <AddColumnButton onAddColumn={onAddColumn} />
            : null;
  }, [onAddColumn, readOnly]);

  const ControlsRowFormatter: React.FC<TFormatterProps> = useCallback(({ row, isRowSelected }) => {
    return !readOnly && isRowSelected
            ? <RemoveRowButton rowId={row.__id__} onRemoveRow={onRemoveRow} />
            : null;
  }, [onRemoveRow, readOnly]);
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
    <div className="remove-row-button" onClick={() => onRemoveRow?.(rowId)}>
      <RemoveRowSvg className="remove-row-icon"/>
    </div>
  );
};
RemoveRowButton.displayName = "RemoveRowButton";
