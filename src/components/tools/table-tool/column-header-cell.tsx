import classNames from "classnames";
import React from "react";
import { EditableHeaderCell } from "./editable-header-cell";
import { THeaderRendererProps, TColumn } from "./table-types";

import "./column-header-cell.scss";

interface IProps extends THeaderRendererProps {
}
export const ColumnHeaderCell: React.FC<IProps> = (props: IProps) => {
  const column = props.column as unknown as TColumn;
  const showExpressions = column.appData?.showExpressions;
  const hasExpression = showExpressions && !!column.appData?.expression;
  const classes = classNames("column-header-cell", { "show-expression": showExpressions });
  return (
    <div className={classes}>
      <div className="flex-container">
        <EditableHeaderCell {...props} />
        {showExpressions && <ExpressionCell column={column} />}
      </div>
      {hasExpression && <div className="expression-divider"/>}
    </div>
  );
};

interface IExpressionCellProps {
  column: TColumn;
}
export const ExpressionCell: React.FC<IExpressionCellProps> = ({ column }) => {
  const { expression } = column?.appData || {};
  const expressionStr = expression ? `= ${expression}` : "";
  const classes = classNames("expression-cell", { "has-expression": !!expression });
  return (
    <div className={classes}>
      {expressionStr}
    </div>
  );
};
