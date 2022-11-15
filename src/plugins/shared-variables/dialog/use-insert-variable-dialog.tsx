import React/*, { useContext }*/ from "react";
import { useSelectMultipleVariables, VariableChipList, VariableType } from "@concord-consortium/diagram-view";

// import { addChipToContent } from "../drawing/drawing-utils";
// import { DrawingContentModelContext } from "../../drawing/components/drawing-content-context";
import { useCustomModal } from "../../../hooks/use-custom-modal";

import InsertVariableChipIcon from "../assets/insert-variable-chip-icon.svg";
import "./variable-dialog.scss";

interface IInsertVariableContent {
  onClick?: (variable: VariableType) => void;
  selectedVariables?: VariableType[];
  variables: VariableType[];
}
const InsertVariableContent = ({ onClick, selectedVariables, variables }: IInsertVariableContent) => {
  return (
    <div className="variable-dialog-content">
      Insert an existing variable:
      <div className="variable-chip-list-container">
        <VariableChipList
          onClick={onClick}
          nameOnly={true}
          selectedVariables={selectedVariables}
          variables={variables}
        />
      </div>
    </div>
  );
};

interface IInsertVariableDialog {
  Icon?: any;
  insertVariables: (variables: VariableType[]) => void;
  variables: VariableType[];
}
export const useInsertVariableDialog = ({ Icon, insertVariables, variables }: IInsertVariableDialog) => {
  const { clearSelectedVariables, selectedVariables, toggleVariable } = useSelectMultipleVariables();

  const handleOk = () => insertVariables(selectedVariables);

  const onClose = clearSelectedVariables;

  const [showModal, hideModal] = useCustomModal({
    Icon: Icon || InsertVariableChipIcon,
    title: "Insert Variables",
    Content: InsertVariableContent,
    contentProps: { onClick: toggleVariable, selectedVariables, variables },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: false,
        onClick: handleOk
      }
    ],
    onClose
  }, [selectedVariables, variables]);

  return [showModal, hideModal];
};
