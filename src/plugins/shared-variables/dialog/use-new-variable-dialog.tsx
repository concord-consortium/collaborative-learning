import { useState, useCallback } from "react";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { EditVariableDialogContent, Variable, VariableType } from "@concord-consortium/diagram-view";

import AddVariableChipIcon from "../assets/add-variable-chip-icon.svg";
import './variable-dialog.scss';
import { SharedVariablesType } from "../shared-variables";

interface IUseNewVariableDialog {
  addVariable: (variable: VariableType ) => void;
  sharedModel?: SharedVariablesType;
  namePrefill? : string;
  onClose?: () => void;
}
export const useNewVariableDialog = ({ addVariable, sharedModel, namePrefill, onClose }: IUseNewVariableDialog) => {
  const [newVariable, setNewVariable] = useState(Variable.create({name: namePrefill || undefined}));

  const handleClick = () => {
    sharedModel?.addAndInsertVariable(newVariable, (variable: VariableType) => addVariable(variable));
    setNewVariable(Variable.create({name: namePrefill || undefined}));
  };

  const [show, hideModal] = useCustomModal({
    Icon: AddVariableChipIcon,
    title: "New Variable",
    Content: EditVariableDialogContent,
    contentProps: { variableClone: newVariable },
    buttons: [
      { label: "Cancel" },
      { label: "Save",
        isDefault: true,
        isDisabled: false,
        onClick: handleClick
      }
    ],
    onClose
  }, [addVariable, newVariable]);

  // Wrap useCustomModal's show so we can prefill with variable name
  const showModal = useCallback(() => {
    if (namePrefill) {
      newVariable.setName(namePrefill);
    }
    show();
  }, [namePrefill, newVariable, show]);

  return [showModal, hideModal];
};
