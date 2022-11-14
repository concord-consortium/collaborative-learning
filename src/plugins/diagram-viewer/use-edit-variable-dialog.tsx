import { useMemo } from "react";
import { getSnapshot } from "mobx-state-tree";
import { useCustomModal } from "../../hooks/use-custom-modal";
import { EditVariableDialogContent, updateVariable, Variable, VariableType } from "@concord-consortium/diagram-view";

import VariableEditorIcon from "../shared-variables/assets/variable-editor-icon.svg";
import './diagram-dialog.scss';

interface IProps {
  variable?: VariableType;
}
export const useEditVariableDialog = ({ variable }: IProps) => {
  const variableClone = useMemo(() => Variable.create(variable ? getSnapshot(variable) : {}), [variable]);

  const handleClick = () => {
    if (variable) {
      updateVariable(variable, variableClone);
    }
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: VariableEditorIcon,
    title: "Variable Editor",
    Content: EditVariableDialogContent,
    contentProps: { variable: variableClone },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: !variable,
        onClick: handleClick
      }
    ]
  }, [variable]);

  return [showModal, hideModal];
};
