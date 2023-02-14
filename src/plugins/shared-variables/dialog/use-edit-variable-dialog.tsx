import React, { useMemo } from "react";
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
  // We use a clone of the variable for the edit dialog so the user can modify its properties but those
  // changes won't be saved unless the Save button is pushed. If changes are made in the edit dialog but
  // not saved, we need to reset the variable clone to match the original variable. To do that, every time
  // the dialog is closed, we increment a counter that is used as a dependency in the useMemo call below.
  const [count, setCount] = React.useState(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const variableClone = useMemo(() => Variable.create(variable ? getSnapshot(variable) : {}), [variable, count]);

  const handleClick = () => {
    if (variable) {
      updateVariable(variable, variableClone);
    }
  };

  const _onClose = () => {
    setCount(c => c + 1);
    onClose?.();
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
    onClose: _onClose
  }, [variable, variableClone, count]);

  return [showModal, hideModal];
};
