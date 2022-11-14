import { useContext, useState } from "react";
import { addChipToContent, getOrFindSharedModel } from "./drawing-utils";
import { DrawingContentModelContext } from "../../drawing/components/drawing-content-context";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { EditVariableDialogContent, Variable } from "@concord-consortium/diagram-view";

import AddVariableChipIcon from "../assets/add-variable-chip-icon.svg";
import '../../diagram-viewer/diagram-dialog.scss';

export const useNewVariableDialog = () => {
  const drawingContent = useContext(DrawingContentModelContext);
  const [newVariable, setNewVariable] = useState(Variable.create({}));

  const handleClick = () => {
    const sharedModel = getOrFindSharedModel(drawingContent);
    sharedModel?.addVariable(newVariable);
    const sharedVariable = sharedModel?.variables.find(v => v === newVariable);
    const dialogVarId = sharedVariable?.id;
    if (dialogVarId) {
      addChipToContent(drawingContent, dialogVarId);
    }
    setNewVariable(Variable.create({}));
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
  }, [newVariable]);

  return [showModal, hideModal];
};
