import React from "react";
import classNames from "classnames";
import { useSelectMultipleVariables, VariableChipList, VariableType } from "@concord-consortium/diagram-view";

import { useCustomModal } from "../../../hooks/use-custom-modal";

import InsertVariableChipIcon from "../assets/insert-variable-chip-icon.svg";
import "./variable-dialog.scss";

interface IInsertVariableContent {
  disallowSelf?: boolean;
  onClick?: (variable: VariableType) => void;
  otherVariables: VariableType[];
  selectedVariables?: VariableType[];
  selfVariables: VariableType[];
  unusedVariables: VariableType[];
}
const InsertVariableContent =
  ({ disallowSelf, onClick, otherVariables, selectedVariables, selfVariables,
    unusedVariables }: IInsertVariableContent) =>
{
  const showSelf = selfVariables.length > 0;
  const showOther = otherVariables.length > 0;
  const showUnused = unusedVariables.length > 0;
  return (
    <div className="variable-dialog-content">
      {showSelf &&
        <>
          Variables already used by this tile:
          <div className="variable-chip-list-container">
            <VariableChipList
              className={classNames({ disabled: disallowSelf })}
              onClick={disallowSelf ? undefined : onClick}
              nameOnly={true}
              selectedVariables={selectedVariables}
              variables={selfVariables}
            />
          </div>
          <div className="dialog-divider" />
        </>
      }
      {showOther &&
        <>
          Variables used by other tiles:
          <div className="variable-chip-list-container">
            <VariableChipList
              onClick={onClick}
              nameOnly={true}
              selectedVariables={selectedVariables}
              variables={otherVariables}
            />
          </div>
          <div className="dialog-divider" />
        </>
      }
      {showUnused &&
        <>
          Unused variables:
          <div className="variable-chip-list-container">
            <VariableChipList
              onClick={onClick}
              nameOnly={true}
              selectedVariables={selectedVariables}
              variables={unusedVariables}
            />
          </div>
          <div className="dialog-divider" />
        </>
      }
    </div>
  );
};

interface IInsertVariableDialog {
  disallowSelf?: boolean; // Set to true to prevent the user from inserting variables already in the tile
  Icon?: any;
  insertVariables: (variables: VariableType[]) => void;
  otherVariables: VariableType[]; // A list of variables used by other tiles
  selfVariables: VariableType[]; // A list of variables used by the tile showing this dialog
  unusedVariables: VariableType[]; // A list of variables not used by any tiles
  onClose?: () => void;
}
export const useInsertVariableDialog = ({
  disallowSelf, Icon, insertVariables, otherVariables, selfVariables, unusedVariables, onClose
}: IInsertVariableDialog) =>
{
  const { clearSelectedVariables, selectedVariables, toggleVariable } = useSelectMultipleVariables();

  const handleOk = () => insertVariables(selectedVariables);

  const handleClose = () => {
    clearSelectedVariables();
    onClose?.();
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: Icon || InsertVariableChipIcon,
    title: "Insert Variables",
    Content: InsertVariableContent,
    contentProps: {
      disallowSelf,
      onClick: toggleVariable,
      selectedVariables,
      otherVariables,
      selfVariables,
      unusedVariables
    },
    buttons: [
      { label: "Cancel" },
      { label: "Insert Variables",
        isDefault: true,
        isDisabled: false,
        onClick: handleOk
      }
    ],
    onClose: handleClose
  }, [selectedVariables, otherVariables, selfVariables, unusedVariables]);

  return [showModal, hideModal];
};
