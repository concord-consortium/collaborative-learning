import { useContext, useState } from "react";
import { getOrFindSharedModel } from "./drawing-utils";
import { VariableChipObjectSnapshotForAdd } from "./variable-object";
import VariablesIcon from "../slate/variables.svg";
import { DrawingContentModelContext } from "../../drawing/components/drawing-content-context";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { EditVariableDialogContent, Variable, VariableType } from "@concord-consortium/diagram-view";

import '../../diagram-viewer/diagram-dialog.scss';

interface IProps {
  variable?: VariableType;
}
export const useNewVariableDialog = ({ variable }: IProps) => {
  const drawingContent = useContext(DrawingContentModelContext);
  const [newVariable, setNewVariable] = useState(Variable.create({}));

  const handleClick = () => {
    // Should we only create a new variable when name and value are legal?
    const sharedModel = getOrFindSharedModel(drawingContent);
    sharedModel?.addVariable(newVariable);
    const sharedVariable = sharedModel?.variables.find(v => v === newVariable);
    const dialogVarId = sharedVariable?.id;
    if (dialogVarId) {
      const variableChipSnapshot: VariableChipObjectSnapshotForAdd = {
        type: "variable",
        x: 250,
        y: 50,
        variableId: dialogVarId
      };
      drawingContent.addObject(variableChipSnapshot);
    }
    setNewVariable(Variable.create({}));
  };

  const [showModal, hideModal] = useCustomModal({
    Icon: VariablesIcon,
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
  }, [newVariable]);

  return [showModal, hideModal];
};
