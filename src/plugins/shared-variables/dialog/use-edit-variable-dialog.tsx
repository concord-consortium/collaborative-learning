import { useMemo, useState } from "react";
import { getSnapshot } from "mobx-state-tree";
import { EditVariableDialogContent, updateVariable, Variable, VariableType } from "@concord-consortium/diagram-view";

import { useCustomModal } from "../../../hooks/use-custom-modal";

import VariableEditorIcon from "../assets/variable-editor-icon.svg";
import './variable-dialog.scss';

interface IProps {
  variable?: VariableType;
  onClose?: () => void;
  setDialogPresent?: (present: boolean) => void;
}
export const useEditVariableDialog = ({ variable, onClose, setDialogPresent }: IProps) => {
  // We use a clone of the variable for the edit dialog so the user can modify its properties, but those
  // changes won't be saved unless the Save button is pushed. We also cache variableClone with useMemo to
  // minimize the number of times it's recreated. These two things cause two side effects:
  // 1. If changes made in the dialog are not saved, variableClone will no longer match variable.
  // 2. Changes made to a variable's properties in a variable card will not cause useMemo to recreate
  // variableClone because useMemo only does a shallow comparison of objects in its dependency array.
  // To address both issues, every time the dialog is opened, we increment a counter that is used as a
  // dependency in the useMemo call.
  const [count, setCount] = useState(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const variableClone = useMemo(() => Variable.create(variable ? getSnapshot(variable) : {}), [variable, count]);

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
    onClose,
    setDialogPresent
  }, [variable, variableClone, count]);

  const _showModal = () => {
    setCount(c => c + 1);
    showModal?.();
  };

  return [_showModal, hideModal];
};
