import React, { useMemo } from "react";
import RowLabelsHiddenSvg from "../../../clue/assets/icons/table/row-labels-hidden-icon.svg";
import RowLabelsShownSvg from "../../../clue/assets/icons/table/row-labels-shown-icon.svg";
import { OnRowSelectionChangeFn, TFormatterProps, TRow } from "./grid-types";

export const useRowLabelsButton = (
  inputRowId: string, showRowLabels: boolean, setShowRowLabels: (show: boolean) => void) => {

  const ShowRowLabelsButton: React.FC = React.memo(() => {
    return (
      <div className="show-hide-row-labels-button" onClick={() => setShowRowLabels(true)}>
        <RowLabelsHiddenSvg className="show-hide-row-labels-icon"/>
      </div>
    );
  });
  ShowRowLabelsButton.displayName = "ShowRowLabelsButton";

  const HideRowLabelsButton: React.FC = React.memo(() => {
    return (
      <div className="show-hide-row-labels-button" onClick={() => setShowRowLabels(false)}>
        <RowLabelsShownSvg className="show-hide-row-labels-icon"/>
      </div>
    );
  });
  HideRowLabelsButton.displayName = "HideRowLabelsButton";

  const handleClick = (e: React.MouseEvent, row: TRow,
                        isRowSelected: boolean, onRowSelectionChange: OnRowSelectionChangeFn) => {
    const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;
    const selected = hasModifier ? !isRowSelected : true;
    if ((e.button === 0) && (selected !== isRowSelected)) {
      if (hasModifier) {
        onRowSelectionChange(selected, e.shiftKey);
      }
      else if (row.__id__ === inputRowId) {
        row.__context__.onClearRowSelection();
      }
      else {
        row.__context__.onSelectOneRow(row.__id__);
      }
    }
  };

  const ShownFormatter = React.memo(({ row, isRowSelected, onRowSelectionChange }: TFormatterProps) => {
    return (
      <div className="index-cell-contents"
          onClick={e => handleClick(e, row, isRowSelected, onRowSelectionChange)}>
        {row.__index__}
      </div>
    );
  });
  ShownFormatter.displayName = "RowLabelsShownFormatter";

  const HiddenFormatter = React.memo(({ row, isRowSelected, onRowSelectionChange }: TFormatterProps) => {
    return (
      <div className="index-cell-contents"
          onClick={e => handleClick(e, row, isRowSelected, onRowSelectionChange)}>
      </div>
    );
  });
  HiddenFormatter.displayName = "RowLabelsHiddenFormatter";

  const RowLabelsButton = useMemo(
          () => showRowLabels ? HideRowLabelsButton : ShowRowLabelsButton,
          [HideRowLabelsButton, ShowRowLabelsButton, showRowLabels]);
  const RowLabelsFormatter = useMemo(
          () => showRowLabels ? ShownFormatter : HiddenFormatter,
          [HiddenFormatter, ShownFormatter, showRowLabels]);

  return { RowLabelsButton, RowLabelsFormatter };
};
