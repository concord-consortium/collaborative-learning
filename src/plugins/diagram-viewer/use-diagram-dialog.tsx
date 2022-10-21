import React, { useEffect, useState } from "react";
import VariablesIcon from "../shared-variables/slate/variables.svg";
import { useCustomModal } from "../../hooks/use-custom-modal";
import { EditVariableDialogContent, updateVariable, VariableType } from "@concord-consortium/diagram-view";

import './diagram-dialog.scss';

interface IProps {
  onClose: () => void;
  variable?: VariableType;
}
export const useDiagramDialog = ({ onClose, variable }: IProps) => {
  const [name, setName] = useState(variable?.name || "");
  const [notes, setNotes] = useState(variable?.description || "");
  const [value, setValue] = useState(variable?.value?.toString() || "");
  const [unit, setUnit] = useState(variable?.unit || "");

  useEffect(() => {
    if (variable) {
      console.log("changing variable", variable);
      setName(variable.name || "");
      setNotes(variable.description || "");
      setValue(variable.value?.toString() || "");
      setUnit(variable.unit || "");
    }
  }, [variable]);

  const handleClick = () => {
    if (variable) {
      updateVariable({ variable, name, notes, value, unit });
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: VariablesIcon,
    title: "Diagram Variables",
    Content: EditVariableDialogContent,
    contentProps: {name, setName, notes, setNotes, value, setValue, unit, setUnit},
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: !variable,
        onClick: handleClick
      }
    ],
    onClose
  }, [name, notes, value, variable, unit]);

  return [showModal, hideModal];
};
