import React, { useCallback } from "react";
import { Tooltip } from "react-tippy";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import RowLabelsHiddenSvg from "../../../clue/assets/icons/table/row-labels-hidden-icon.svg";
import RowLabelsShownSvg from "../../../clue/assets/icons/table/row-labels-shown-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { TFormatterProps, kHeaderRowHeight } from "./table-types";
import { RowDivider } from "./row-divider";
import DragIndicator from "../../../clue/assets/icons/table/row-drag-indicator.svg";

export const kTableRowDividerHeight = 9;
export const kTableDividerOffset = Math.ceil(kTableRowDividerHeight / 2);
interface IProps {
  inputRowId: string;
  hoveredRowId: string | null;
  showRowLabels: boolean;
  dragOverRowId?: string | null;
  setShowRowLabels: (show: boolean) => void;
  setHoveredRowId: (rowId: string | null) => void;
  setDragOverRowId: (rowId: string | null) => void;
  gridElement?: HTMLDivElement | null;
  rowHeight: (args: any) => number;
}

export const useRowLabelColumn = ({inputRowId, hoveredRowId, showRowLabels, setShowRowLabels, setHoveredRowId,
                dragOverRowId, setDragOverRowId, gridElement, rowHeight}: IProps) => {
  const title = showRowLabels ? "Hide labels" : "Show labels";
  const tooltipOptions = useTooltipOptions({ title, distance: -2 });

  const RowLabelHeader: React.FC = useCallback(() => {
    return (
      <Tooltip {...tooltipOptions}>
        <div className={`show-hide-row-labels-button ${showRowLabels ? "shown" : "hidden"}`}
              onClick={() => setShowRowLabels(!showRowLabels)}>
          <RowLabelsShownSvg className="hide-row-labels-icon"/>
          <RowLabelsHiddenSvg className="show-row-labels-icon"/>
        </div>
      </Tooltip>
    );
  }, [setShowRowLabels, showRowLabels, tooltipOptions]);
  RowLabelHeader.displayName = "RowLabelHeader";

  const RowLabelFormatter: React.FC<TFormatterProps> = useCallback(({
    row, isRowSelected, onRowSelectionChange
  }: TFormatterProps) => {
    const { __id__, __index__, __context__ } = row;
    const rowHeightValue = rowHeight({ row, type: "ROW" });

    const DraggableRowLabel: React.FC = () => {
      const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: __id__ });
      const isInputRow = __id__ === inputRowId;
      const rowTop = __index__ ? (__index__ - 1) * rowHeight({ row, type: "ROW" }) + kHeaderRowHeight : 0;

      const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;
        const selected = hasModifier ? !isRowSelected : true;
        if (e.button === 0) {
          if (selected !== isRowSelected) {
            if (hasModifier) {
              onRowSelectionChange(selected, e.shiftKey);
            }
            else if (__id__ === inputRowId) {
              __context__.onClearSelection({ cell: false });
            }
            else {
              __context__.onSelectOneRow(__id__);
            }
          }
        }
      };

      return (
        <div className="index-cell-wrapper" onPointerDown={handleClick} onDoubleClick={handleClick}
          onPointerOver={() => setHoveredRowId(__id__)} onPointerLeave={() => setHoveredRowId(null)}>
          { (__index__ === 1 && gridElement) &&
            createPortal(
              <RowDivider rowId={__id__} before={true} dragOverRowId={dragOverRowId} setDragOverRowId={setDragOverRowId}
                          topPosition={rowTop - 5} gridElement={gridElement}/>
              , gridElement)
          }
          <div className="index-cell-contents" ref={setDragRef}
                {...(!isInputRow ? { ...attributes, ...listeners } : {})}>
            {(hoveredRowId === __id__ && !isInputRow) && <DragIndicator className="row-drag-icon" />}
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

    return <DraggableRowLabel />;
  }, [hoveredRowId, inputRowId, setDragOverRowId, setHoveredRowId, showRowLabels, dragOverRowId,
      gridElement, rowHeight
    ]);

  return { RowLabelHeader, RowLabelFormatter };
};
