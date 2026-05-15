import classNames from "classnames";
import React, { useCallback, useEffect, useRef } from "react";
import { EditableHeaderCell } from "./editable-header-cell";
import { kHeaderRowHeight, THeaderRendererProps, TColumn } from "./table-types";
import { useCautionAlert } from "../../utilities/use-caution-alert";
import { TSortDirection } from "../../../models/data/data-set";
import RemoveColumnSvg from "../../../assets/icons/remove/remove.nosvgo.svg";
import SortIcon from "../../../assets/sort-column-icon.svg";

import "./column-header-cell.scss";

interface IUseColumnHeaderCellArgs {
  height: number;
  getSortDirection: (columnKey: string) => TSortDirection;
  onSort: (columnKey: string, direction: TSortDirection) => void;
}

export const useColumnHeaderCell = ({height, getSortDirection, onSort}: IUseColumnHeaderCellArgs) => {
  // The column is memoized. If the sort order matches the original sort order, it does not re-render.
  // This makes sure we re-render the column header cell when the sort order changes.
  const [, setSortDir] = React.useState<TSortDirection>("NONE");
  return React.useMemo(() => {
    const ColumnHeaderCell: React.FC<THeaderRendererProps> = (props) => {
      const column = props.column as unknown as TColumn;
      const cellTabIndex = props.tabIndex;
      const { gridContext, readOnly, isEditing, isRemovable, showExpressions, hasData,
              onRemoveColumn } = column.appData || {};
      const direction = getSortDirection(column.key);
      useEffect(() => {
        // Update the sort direction state when the column key changes
        setSortDir(direction);
      }, [column.key, direction]);

      // `.header-name` is the cell's canonical tab stop; the other siblings
      // always carry tabindex=-1 so RDG's focusCellOrCellContent finds exactly
      // one [tabindex="0"] (the .header-name in the selected cell).
      const showRemove = !isEditing && !!isRemovable;
      const showSort = !!hasData;

      const removeRef = useRef<HTMLButtonElement | null>(null);
      const nameRef = useRef<HTMLDivElement | null>(null);
      const sortRef = useRef<HTMLButtonElement | null>(null);

      // Arrow Left/Right rove between visible siblings. No persistent state:
      // we read the currently-focused element and move to the next visible
      // sibling via .focus() (which works on tabindex=-1 elements).
      const handleArrow = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const visible: HTMLElement[] = [];
        if (showRemove && removeRef.current) visible.push(removeRef.current);
        if (nameRef.current) visible.push(nameRef.current);
        if (showSort && sortRef.current) visible.push(sortRef.current);
        const active = document.activeElement as HTMLElement | null;
        const idx = active ? visible.indexOf(active) : -1;
        if (idx < 0) return;
        const nextIdx = e.key === "ArrowRight" ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= visible.length) {
          // At first/last sibling: stay put (ARIA composite-widget convention).
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        visible[nextIdx].focus();
      }, [showRemove, showSort]);

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
        // Always stop propagation: react-data-grid 7.0.0-beta.44's HeaderCell now has its
        // own onClick that calls selectCell({idx, rowIdx: -1}), which interferes with our
        // column selection handling. canary.46 had no such onClick.
        e.stopPropagation();
        if (!gridContext?.isColumnSelected(column.key)) {
          gridContext?.onSelectColumn(column.key);
        }
      };
      const handleHeaderFocus = () => {
        if (!gridContext?.isColumnSelected(column.key)) {
          gridContext?.onSelectColumn(column.key);
        }
      };

      const handleSort = (e: React.MouseEvent) => {
        if (gridContext?.isColumnSelected(column.key)) {
          let newDirection: TSortDirection;
          if (direction === "ASC") newDirection = "DESC";
          else if (direction === "DESC") newDirection = "NONE";
          else newDirection = "ASC";
          onSort(column.key, newDirection);
          setSortDir(newDirection);
        }
      };

      return (
        <div
          className={classes}
          onMouseOver={handleColumnHeaderCellMouseOver}
          onMouseLeave={handleColumnHeaderCellMouseLeave}
          onClick={handleHeaderClick}
          onFocus={handleHeaderFocus}
          onKeyDown={handleArrow}
        >
          <div className="flex-container">
            <div className={classNames("header-cell-container", {"show-expression": showExpressions})}>
              {showRemove &&
                <RemoveColumnButton colId={column.key} colName={column.name as string} onRemoveColumn={onRemoveColumn}
                  isColumnSelected={gridContext?.isColumnSelected(column.key) ?? false}
                  buttonRef={removeRef}/>
              }
              <EditableHeaderCell
                {...props}
                ref={nameRef}
                height={height}
                column={column as any}
                headerNameTabIndex={cellTabIndex}
              />
              {showSort &&
                <button
                  type="button"
                  ref={sortRef}
                  className={classNames("column-button sort-column-button", { "ascending": direction === "ASC",
                                      "descending": direction === "DESC" })}
                  aria-label={
                    direction === "ASC"
                      ? "Sorted ascending"
                      : direction === "DESC"
                      ? "Sorted descending"
                      : "Not sorted"
                  }
                  tabIndex={-1}
                  onClick={handleSort}
                >
                  <SortIcon
                    className={classNames("column-icon sort-column-icon")}
                    data-testid={`sort-indicator-${column.key}`}
                  />
                </button>
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
  buttonRef: React.MutableRefObject<HTMLButtonElement | null>;
}
const RemoveColumnButton: React.FC<IRemoveColumnButtonProps> =
        ({ colId, colName, isColumnSelected, onRemoveColumn, buttonRef }) => {
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
    <button
      type="button"
      ref={buttonRef}
      className="column-button remove-column-button"
      aria-label={`Remove column ${colName}`}
      tabIndex={-1}
      onClick={handleClick}
    >
      <RemoveColumnSvg className="column-icon remove-column-icon"/>
    </button>
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
