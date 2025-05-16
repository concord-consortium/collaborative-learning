import classNames from "classnames";
import clsx from "clsx";
import React, { useMemo } from "react";
import { EditableHeaderCell } from "./editable-header-cell";
import { kHeaderRowHeight, THeaderRendererProps, TColumn } from "./table-types";
import { useCautionAlert } from "../../utilities/use-caution-alert";
import RemoveColumnSvg from "../../../assets/icons/remove/remove.nosvgo.svg";
import SortIcon from "../../../assets/sort-column-icon.svg";

import "./column-header-cell.scss";

interface IProps extends THeaderRendererProps {
}
export const useColumnHeaderCell = (height: number) => {
  return useMemo(() => {
    const ColumnHeaderCell: React.FC<IProps> = (props: IProps) => {
      const column = props.column as unknown as TColumn;
      const { gridContext, readOnly, isEditing, isRemovable, showExpressions, onRemoveColumn } = column.appData || {};
      const [ columnHeaderHover, setColumnHeaderHover ] = React.useState(false);
      const classes = classNames("column-header-cell",
                        { "show-expression": showExpressions,
                          "selected-column": gridContext?.isColumnSelected(column.key),}
                      );

      // FIXME: temporary local state
      const [sortDirection, setSortDirection] = React.useState<"ascending" | "descending" | undefined>(undefined);

      const handleColumnHeaderCellMouseOver = (e: React.MouseEvent) => {
        console.log("in handleColumnHeaderCellMouseOver gridContext.isColumnSelected",
            gridContext?.isColumnSelected(column.key));

        if (!gridContext?.isColumnSelected(column.key)) {
          setColumnHeaderHover(true);
          document.querySelectorAll(`.column-${column.key}`).forEach(cell => {
            cell.classList.add("hovered-column");
          });
        }
      };
      const handleColumnHeaderCellMouseLeave = (e: React.MouseEvent) => {
        setColumnHeaderHover(false);
        document.querySelectorAll(`.column-${column.key}`).forEach(cell => {
          cell.classList.remove("hovered-column");
        });
      };
      const handleHeaderClick = (e: React.MouseEvent) => {
        if (!gridContext?.isColumnSelected(column.key)) {
          e.stopPropagation();
          gridContext?.onSelectColumn(column.key);
          setColumnHeaderHover(false);
        }
      };

      const handleSort = (e: React.MouseEvent) => {
        if (gridContext?.isColumnSelected(column.key)) {
          e.stopPropagation();
          if (sortDirection === "ascending") {
            setSortDirection("descending");
          } else if (sortDirection === "descending") {
            setSortDirection(undefined);
          } else {
            setSortDirection("ascending");
          }
        }
      };
      console.log("sortDirection", sortDirection);
      console.log("gridContext.isColumnSelected", gridContext?.isColumnSelected(column.key));

      return (
        <div className={classes} onMouseOver={handleColumnHeaderCellMouseOver}
              onMouseLeave={handleColumnHeaderCellMouseLeave} onClick={handleHeaderClick}>
          <div className="header-cell-container">
            {!isEditing && isRemovable &&
              <RemoveColumnButton colId={column.key} colName={column.name as string} onRemoveColumn={onRemoveColumn}
                isColumnSelected={gridContext?.isColumnSelected(column.key) ?? false}/>
            }
            <div className="flex-container">
              <EditableHeaderCell height={height} {...props} />
              {showExpressions && <ExpressionCell readOnly={readOnly} column={column} />}
            </div>
            <div className={clsx("column-button sort-column-button", { "ascending": sortDirection === "ascending",
                                  "descending": sortDirection === "descending" })} onClick={handleSort}>
              <SortIcon className={clsx("column-icon sort-column-icon")} />
            </div>
          </div>
        </div>
      );
    };
    return ColumnHeaderCell;
  }, [height]);
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
