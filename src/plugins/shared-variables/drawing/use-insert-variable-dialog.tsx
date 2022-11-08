import React, { useContext, useState } from "react";
import { getOrFindSharedModel } from "./drawing-utils";
import { VariableChipObjectSnapshotForAdd } from "./variable-object";
import VariablesIcon from "../slate/variables.svg";
import { DrawingContentModelContext } from "../../drawing/components/drawing-content-context";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { Variable, VariableChipList, VariableType } from "@concord-consortium/diagram-view";

import '../../diagram-viewer/diagram-dialog.scss';

interface IInsertVariableContent {
  variables: VariableType[];
}
const InsertVariableContent = ({ variables }: IInsertVariableContent) => {
  return <VariableChipList variables={variables} />;
};

interface IInsertVariableDialog {
  variables: VariableType[];
}
export const useInsertVariableDialog = ({ variables }: IInsertVariableDialog) => {
  const drawingContent = useContext(DrawingContentModelContext);
  const [newVariable, setNewVariable] = useState(Variable.create({}));

  const handleClick = () => {
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
    title: "Insert Variable",
    Content: InsertVariableContent,
    contentProps: { variables },
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
