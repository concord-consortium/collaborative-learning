import React, { useState } from "react";
import Select from "react-select";
import { useCustomModal } from "../../../hooks/use-custom-modal";

import VariableToolIcon from "../../../clue/assets/icons/variable-tool.svg";

import './variable-dialog.scss';

const options = [
  { label: "pool", value: "Pool"},
  { label: "stripes", value: "Stripes"},
  { label: "solids", value: "solids"},
];

const ModalContent = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const name = "var";
  return (
    <div className="content">
      <div className="variable-choices">
        Select existing variable:
        <Select
          name={name}
          options={options}
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

export const useVariableDialog = () => {
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
