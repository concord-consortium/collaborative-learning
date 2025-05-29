import classNames from "classnames";
import React, { useMemo } from "react";
import { EditableHeaderCell } from "./editable-header-cell";
import { kHeaderRowHeight, TColumn, THeaderRendererProps } from "./table-types";
import { useCautionAlert } from "../../utilities/use-caution-alert";
import RemoveColumnSvg from "../../../assets/icons/remove/remove.nosvgo.svg";
import SortIcon from "../../../assets/sort-column-icon.svg";

import "./column-header-cell.scss";

interface IUseColumnHeaderCellArgs {
  height: number;
  getSortDirection: (columnKey: string) => "ASC" | "DESC" | "NONE";
  onSort?: (columnKey: string, direction: "ASC" | "DESC" | "NONE") => void;
}

export const useColumnHeaderCell = ({height, getSortDirection, onSort}: IUseColumnHeaderCellArgs) => {
  return useMemo(() => {
    const ColumnHeaderCell: React.FC<THeaderRendererProps> = (props) => {
      const column = props.column as unknown as TColumn;
      const { gridContext, readOnly, isEditing, isRemovable, showExpressions, hasData,
              onRemoveColumn } = column.appData || {};
      const direction = getSortDirection(column.key);

      const classes = classNames("column-header-cell",
                        { "show-expression": showExpressions,
                          "selected-column": gridContext?.isColumnSelected(column.key),}
                      );

      const handleColumnHeaderCellMouseOver = (e: React.MouseEvent) => {
        if (!gridContext?.isColumnSelected(column.key)) {
          document.querySelectorAll(`.column-${column.key}`).forEach(cell => {
            cell.classList.add("hovered-column");
          });
        }
      };
      const handleColumnHeaderCellMouseLeave = (e: React.MouseEvent) => {
        document.querySelectorAll(`.column-${column.key}`).forEach(cell => {
          cell.classList.remove("hovered-column");
        });
      };
      const handleHeaderClick = (e: React.MouseEvent) => {
        if (!gridContext?.isColumnSelected(column.key)) {
          e.stopPropagation();
          gridContext?.onSelectColumn(column.key);
        }
      };

      const handleSort = (e: React.MouseEvent) => {
        if (gridContext?.isColumnSelected(column.key)) {
          let newDirection: "ASC" | "DESC" | "NONE";
          if (direction === "ASC") newDirection = "DESC";
          else if (direction === "DESC") newDirection = "NONE";
          else newDirection = "ASC";

          onSort?.(column.key, newDirection);
          onSort?.(column.key, newDirection);
        }
      };

      return (
        <div className={classes} onMouseOver={handleColumnHeaderCellMouseOver}
              onMouseLeave={handleColumnHeaderCellMouseLeave} onClick={handleHeaderClick}>
          <div className="flex-container">
            <div className={classNames("header-cell-container", {"show-expression": showExpressions})}>
            <div className={classNames("header-cell-container", {"show-expression": showExpressions})}>
              {!isEditing && isRemovable &&
                <RemoveColumnButton colId={column.key} colName={column.name as string} onRemoveColumn={onRemoveColumn}
                  isColumnSelected={gridContext?.isColumnSelected(column.key) ?? false}/>
              }
              <EditableHeaderCell
                height={height}
                column={column as any}
                allRowsSelected={props.allRowsSelected}
                onAllRowsSelectionChange={props.onAllRowsSelectionChange}
              />
              {hasData &&
                <div className={classNames("column-button sort-column-button", { "ascending": direction === "ASC",
                                      "descending": direction === "DESC" })} onClick={handleSort}>
                  <SortIcon
                    className={classNames("column-icon sort-column-icon")}
                    data-testid={`sort-indicator-${column.key}`}
                    aria-label={
                      direction === "ASC"
                        ? "Sorted ascending"
                        : direction === "DESC"
                          ? "Sorted descending"
                          : "Not sorted"
                    }
                  />
                </div>
              }
            </div>
            {showExpressions && <ExpressionCell readOnly={readOnly} column={column} />}
          </div>

        </div>
      );
    };
    return ColumnHeaderCell;
  }, [getSortDirection, height, onSort]);
};

interface IRemoveColumnButtonProps {
  colId: string;
  colName: string;
  isColumnSelected: boolean;
  onRemoveColumn?: (colId: string) => void;
}
const RemoveColumnButton: React.FC<IRemoveColumnButtonProps> =
        ({ colId, colName, isColumnSelected, onRemoveColumn }) => {
  const AlertContent = () => {
    return <p>Remove column <b>{colName}</b> and its contents from the table?</p>;
  };
  const [showAlert] = useCautionAlert({
    title: "Remove Column",
    content: AlertContent,
    confirmLabel: "Remove Column",
    onConfirm: () => onRemoveColumn?.(colId)
  });

  const handleClick = () => {
    if (isColumnSelected) {
      showAlert();
    }
  };
  return (
    <div className="column-button remove-column-button" onClick={handleClick}>
      <RemoveColumnSvg className="column-icon remove-column-icon"/>
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
