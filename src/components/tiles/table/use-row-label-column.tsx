import React, { useCallback } from "react";
import { Tooltip } from "react-tippy";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import RowLabelsHiddenSvg from "../../../clue/assets/icons/table/row-labels-hidden-icon.svg";
import RowLabelsShownSvg from "../../../clue/assets/icons/table/row-labels-shown-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { TFormatterProps } from "./table-types";

import DragIndicator from "../../../clue/assets/icons/table/row-drag-indicator.svg";

interface IProps {
  inputRowId: string;
  hoveredRowId: string | null;
  showRowLabels: boolean;
  setShowRowLabels: (show: boolean) => void;
  setHoveredRowId: (rowId: string | null) => void;
}
export const useRowLabelColumn = ({
  inputRowId, hoveredRowId, showRowLabels, setShowRowLabels, setHoveredRowId
}: IProps) => {

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

    const DraggableRowLabel: React.FC = () => {
      const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: __id__ });
      const { setNodeRef: setDropRef } = useDroppable({ id: __id__ });

      const handleClick = (e: React.MouseEvent) => {
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
        <div
          className="index-cell-wrapper"
          onClick={handleClick}
          onDoubleClick={handleClick}
          onMouseEnter={() => setHoveredRowId(__id__)}
          onMouseLeave={() => setHoveredRowId(null)}
          ref={setDropRef}
        >
          <span className="index-cell-contents" ref={setDragRef} {...attributes} {...listeners}>
            {hoveredRowId === __id__ && <DragIndicator className="row-drag-icon" />}
            {showRowLabels ? <span className="row-index-label">{__index__}</span> : undefined}
          </span>
        </div>
      );
    };

    return <DraggableRowLabel />;
  }, [hoveredRowId, inputRowId, setHoveredRowId, showRowLabels]);

  return { RowLabelHeader, RowLabelFormatter };
};
