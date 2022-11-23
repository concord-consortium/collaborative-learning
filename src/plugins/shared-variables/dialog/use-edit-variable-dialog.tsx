import { useMemo } from "react";
import { getSnapshot } from "mobx-state-tree";
import { EditVariableDialogContent, updateVariable, Variable, VariableType } from "@concord-consortium/diagram-view";

//import { useCustomModal } from "../../../hooks/use-custom-modal";

import VariableEditorIcon from "../assets/variable-editor-icon.svg";
import './variable-dialog.scss';

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

  // const [showModal, hideModal] = useCustomModal({
  //   Icon: VariableEditorIcon,
  //   title: "Variable Editor",
  //   Content: EditVariableDialogContent,
  //   contentProps: { variable: variableClone },
  //   buttons: [
  //     { label: "Cancel" },
  //     { label: "OK",
  //       isDefault: true,
  //       isDisabled: !variable,
  //       onClick: handleClick
  //     }
  //   ]
  // }, [variable]);
  // FIXME: CustomModal was getting the wrong type.
  const showModal = () => {console.log('show modal');}
  const hideModal = () => {console.log('hide modal');}

  return [showModal, hideModal];
};
