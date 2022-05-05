import React, { useState } from "react";
import Select from "react-select";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";
import VariableToolIcon from "../../../clue/assets/icons/variable-tool.svg";

import './variable-dialog.scss';

export type SelectValue = { value: string, label: string };
export type SelectOptions = SelectValue[];

export const useVariableDialog = (toolContent: DrawingContentModelType) => {
  const fieldValues: Record<string, any> = [
    { name: "Pool", value: 1 },
    { name: "stripes", value: 6 },
    { name: "solids", value: 9 }
  ];
  const varOptions = [
    { label: "pool", value: "Pool"},
    { label: "stripes", value: "Stripes"},
    { label: "solids", value: "Solids"},
  ];

  function getSelectValue(options: SelectOptions | undefined, name: string) {
    return options?.find(opt => opt.value === fieldValues[name]);
  }

  const ModalContent = () => {
      const [isMenuOpen, setIsMenuOpen] = useState(false);
      const name = "stripes";
    return (
      <div className="content">
        <div className="variable-choices">
          Select existing variable:
          <Select
            name={name}
            options={varOptions}
            value={getSelectValue(varOptions, name)}
            onMenuOpen={() => setIsMenuOpen(true)}
            onMenuClose={() => setIsMenuOpen(false)}
          />
        </div>
        <p>or</p>
        <div className="new-variable">
          Create new variable:
          <div className="new-variable-inputs inline-row input-entry">
            <label className="label">Name: </label><input type="text" className="input" />
            <label className="label">Value: </label><input type="text" className="input" />
          </div>
        </div>
      </div>
    );
  };

  const buttons = [ { label: "Cancel" },
                    {  label: "OK" }
                  ];

  const [showVariableDialog, hideVariableDialog] = useCustomModal({
    className: "variable-dialog",
    title: "Insert Variable",
    Icon: VariableToolIcon,
    Content: ModalContent,
    contentProps: {},
    buttons,
  }, [buttons]);
  return [showVariableDialog, hideVariableDialog];
};
