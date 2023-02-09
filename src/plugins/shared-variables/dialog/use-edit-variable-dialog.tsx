import { useMemo } from "react";
import { getSnapshot } from "mobx-state-tree";
import { EditVariableDialogContent, updateVariable, Variable, VariableType } from "@concord-consortium/diagram-view";

import { useCustomModal } from "../../../hooks/use-custom-modal";

import VariableEditorIcon from "../assets/variable-editor-icon.svg";
import './variable-dialog.scss';

interface IProps {
  variable?: VariableType;
  onClose?: () => void;
}
export const useEditVariableDialog = ({ variable, onClose }: IProps) => {
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
    // Because variableClone is created from a snapshot, it will not have computed values
    // related to the original variable's inputs. We will need to get those values from the
    // original variable. So pass both variable and variableClone to EditVariableDialogContent
    contentProps: { variable, variableClone },
    buttons: [
      { label: "Cancel" },
      { label: "Save",
        isDefault: true,
        isDisabled: !variable,
        onClick: handleClick
      }
    ],
    onClose
  }, [variable]);

  return [showModal, hideModal];
};
