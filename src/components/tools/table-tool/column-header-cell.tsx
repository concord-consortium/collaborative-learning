import classNames from "classnames";
import React from "react";
import { EditableHeaderCell } from "./editable-header-cell";
import { kHeaderRowHeight, THeaderRendererProps, TColumn } from "./table-types";
import { useCautionAlert } from "../../utilities/use-caution-alert";
import RemoveColumnSvg from "../../../assets/icons/remove/remove.nosvgo.svg";

import "./column-header-cell.scss";

interface IProps extends THeaderRendererProps {
}
export const getColumnHeaderCell = (height: number) => {
  const ColumnHeaderCell: React.FC<IProps> = (props: IProps) => {
    const column = props.column as unknown as TColumn;
    const { readOnly, isEditing, isRemovable, showExpressions, onRemoveColumn } = column.appData || {};
    const classes = classNames("column-header-cell", { "show-expression": showExpressions });
    return (
      <div className={classes}>
        <div className="flex-container">
          <EditableHeaderCell height={height} {...props} />
          {showExpressions && <ExpressionCell readOnly={readOnly} column={column} />}
        </div>
        {!isEditing && isRemovable &&
          <RemoveColumnButton colId={column.key} colName={column.name as string} onRemoveColumn={onRemoveColumn}/>}
      </div>
    );
  };
  return ColumnHeaderCell;
};

interface IRemoveColumnButtonProps {
  colId: string;
  colName: string;
  onRemoveColumn?: (colId: string) => void;
}
const RemoveColumnButton: React.FC<IRemoveColumnButtonProps> = ({ colId, colName, onRemoveColumn }) => {
  const AlertContent = () => {
    return <p>Remove column <b>{colName}</b> and its contents from the table?</p>;
  };
  const [showAlert] = useCautionAlert({
    title: "Remove Column",
    content: AlertContent,
    confirmLabel: "Remove Column",
    onConfirm: () => onRemoveColumn?.(colId)
  });
  return (
    <div className="remove-column-button" onClick={showAlert}>
      <RemoveColumnSvg className="remove-column-icon"/>
    </div>
  );
};
RemoveColumnButton.displayName = "RemoveColumnButton";

interface IExpressionCellProps {
  readOnly?: boolean;
  column: TColumn;
}
export const ExpressionCell: React.FC<IExpressionCellProps> = ({ readOnly, column }) => {
  const { expression, onShowExpressionsDialog } = column?.appData || {};
  const expressionStr = expression ? `= ${expression}` : "";
  const classes = classNames("expression-cell", { "has-expression": !!expression });
  const handleClick = () => !readOnly && expression && onShowExpressionsDialog?.(column.key);
  return (
    <div className={classes} onClick={handleClick}
      style={{ height: kHeaderRowHeight }}>
      {expressionStr}
    </div>
  );
};
