import React, { useContext, useState } from "react";
import { VariableChipList, VariableType } from "@concord-consortium/diagram-view";

import { addChipToContent } from "./drawing-utils";
import { DrawingContentModelContext } from "../../drawing/components/drawing-content-context";
import { useCustomModal } from "../../../hooks/use-custom-modal";

import InsertVariableChipIcon from "../assets/insert-variable-chip-icon.svg";
import "./variable-dialog.scss";

interface IInsertVariableContent {
  onClick?: (variable: VariableType) => void;
  selectedVariables?: VariableType[];
  variables: VariableType[];
}
const InsertVariableContent = ({ onClick, selectedVariables, variables }: IInsertVariableContent) => {
  return (
    <div className="insert-variable-dialog-content">
      Insert an existing variable:
      <div className="variable-chip-list-container">
        <VariableChipList
          onClick={onClick}
          nameOnly={true}
          selectedVariables={selectedVariables}
          variables={variables}
        />
      </div>
    </div>
  );
};

interface IInsertVariableDialog {
  variables: VariableType[];
}
export const useInsertVariableDialog = ({ variables }: IInsertVariableDialog) => {
  const drawingContent = useContext(DrawingContentModelContext);
  const [selectedVariables, setSelectedVariables] = useState<VariableType[]>([]);
  const onChipClick = (variable: VariableType) => {
    let foundVariable = false;
    const newSV = [];
    selectedVariables.forEach(v => {
      if (v === variable) {
        foundVariable = true;
      } else {
        newSV.push(v);
      }
    });
    if (!foundVariable) newSV.push(variable);
    setSelectedVariables(newSV);
  };

  const handleOk = () => {
    let x = 250;
    let y = 50;
    const offset = 25;
    selectedVariables.forEach(variable => {
      addChipToContent(drawingContent, variable.id, x, y);
      x += offset;
      y += offset;
    });
  };

  const onClose = () => setSelectedVariables([]);

  const [showModal, hideModal] = useCustomModal({
    Icon: InsertVariableChipIcon,
    title: "Insert Variables",
    Content: InsertVariableContent,
    contentProps: { onClick: onChipClick, selectedVariables, variables },
    buttons: [
      { label: "Cancel" },
      { label: "OK",
        isDefault: true,
        isDisabled: false,
        onClick: handleOk
      }
    ],
    onClose
  }, [selectedVariables, variables]);

  return [showModal, hideModal];
};
