import { useState } from "react";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { EditVariableDialogContent, Variable, VariableType } from "@concord-consortium/diagram-view";

import AddVariableChipIcon from "../assets/add-variable-chip-icon.svg";
import './variable-dialog.scss';
import { SharedVariablesType } from "../shared-variables";

interface IUseNewVariableDialog {
  addVariable: (variable: VariableType ) => void;
  sharedModel: SharedVariablesType;
  namePrefill? : string // FIXME
}
export const useNewVariableDialog = ({ addVariable, sharedModel, namePrefill }: IUseNewVariableDialog) => {
  // FIXME: This doesn't work because the variable isn't getting created every time the prop changes.
  // What should I do instead?
  const [newVariable, setNewVariable] = useState(Variable.create({name: namePrefill || undefined}));

  const handleClick = () => {
    console.log('handle click');
    sharedModel.addVariable(newVariable);
    const sharedVariable = sharedModel?.variables.find(v => v === newVariable);
    if (sharedVariable) {
      addVariable(sharedVariable);
    }
    setNewVariable(Variable.create({name: namePrefill || undefined}));
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: AddVariableChipIcon,
    title: "New Variable",
    Content: EditVariableDialogContent,
    contentProps: { variable: newVariable },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: false,
        onClick: handleClick
      }
    ]
  }, [addVariable, newVariable]);

  return [showModal, hideModal];
};
