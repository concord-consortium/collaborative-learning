import React, { useCallback } from "react";
import { Tooltip } from "react-tippy";
import RowLabelsHiddenSvg from "../../../clue/assets/icons/table/row-labels-hidden-icon.svg";
import RowLabelsShownSvg from "../../../clue/assets/icons/table/row-labels-shown-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { TFormatterProps } from "./grid-types";

export const useRowLabelColumn = (
  inputRowId: string, showRowLabels: boolean, setShowRowLabels: (show: boolean) => void) => {

  const title = showRowLabels ? "Hide labels" : "Show labels";
  const tooltipOptions = useTooltipOptions({ title, distance: -36 });

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
    const handleClick = (e: React.MouseEvent) => {
      const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;
      const selected = hasModifier ? !isRowSelected : true;
      if ((e.button === 0) && (selected !== isRowSelected)) {
        if (hasModifier) {
          onRowSelectionChange(selected, e.shiftKey);
        }
        else if (__id__ === inputRowId) {
          __context__.onClearRowSelection();
        }
        else {
          __context__.onSelectOneRow(__id__);
        }
      }
    };

    return (
      <div className="index-cell-contents" onClick={handleClick}>
        {showRowLabels ? __index__ : undefined}
      </div>
    );
  }, [inputRowId, showRowLabels]);

  return { RowLabelHeader, RowLabelFormatter };
};
