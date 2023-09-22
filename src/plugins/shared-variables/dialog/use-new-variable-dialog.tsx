import { useState, useCallback } from "react";
import { EditVariableDialogContent, Variable, VariableType } from "@concord-consortium/diagram-view";

import { useCustomModal } from "../../../hooks/use-custom-modal";
import { SharedVariablesType } from "../shared-variables";
import AddVariableChipIcon from "../assets/add-variable-chip-icon.svg";

import './variable-dialog.scss';

interface IUseNewVariableDialog {
  addVariable: (variable: VariableType ) => void;
  sharedModel?: SharedVariablesType;
  descriptionPrefill?: string;
  noUndo?: boolean;
  onClose?: () => void;
}
export const useNewVariableDialog = ({
  addVariable, sharedModel, descriptionPrefill, noUndo = false, onClose
}: IUseNewVariableDialog) => {
  const [newVariable, setNewVariable] = useState(Variable.create({ description: descriptionPrefill || undefined }));

  const handleClick = () => {
    sharedModel?.addAndInsertVariable(
      newVariable,
      (variable: VariableType) => addVariable(variable),
      noUndo
    );
    setNewVariable(Variable.create({ description: descriptionPrefill || undefined }));
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
    onClose,
  }, [addVariable, newVariable]);

  // Wrap useCustomModal's show so we can prefill with variable description
  const showModal = useCallback(() => {
    newVariable.setDescription(descriptionPrefill ?? "");
    show();
  }, [descriptionPrefill, newVariable, show]);

  return [showModal, hideModal];
};
