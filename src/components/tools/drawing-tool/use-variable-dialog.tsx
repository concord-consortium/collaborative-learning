import React, { useState } from "react";
import Select from "react-select";
import { useCustomModal } from "../../../hooks/use-custom-modal";

import './variable-dialog.scss';

export const useVariableDialog = (options: {
  label: string;
  value: string;
}[]) => {

  const ModalContent = () => {
      const [isMenuOpen, setIsMenuOpen] = useState(false);
      const name = "var";
      const customStyles = {
        container: (provided: any) => ({
          ...provided,
          padding: '5px'
        }),
        control: (provided: any, state: any) => ({
          ...provided,
          background: '#fff',
          borderColor: '#9e9e9e',
          borderRadius: '2px',
          minHeight: '30px',
          height: '30px',
          boxShadow: state.isFocused ? null : null,
          cursor: 'pointer'
        }),
        valueContainer: (provided: any) => ({
          ...provided,
          height: '30px',
          padding: '0 6px'
        }),

        input: (provided: any) => ({
          ...provided,
          margin: '0px',
        }),
        indicatorSeparator: (state: any) => ({
          display: 'none',
        }),
        indicatorsContainer: (provided: any) => ({
          ...provided,
          height: '30px',
        }),
        option: (provided: any) => ({
          ...provided,
          cursor: 'pointer'
        }),
      };
    return (
      <div className="content">
        <div className="variable-choices">
          Select existing variable:
          <Select
            name={name}
            styles={customStyles}
            options={options}
            onMenuOpen={() => setIsMenuOpen(true)}
            onMenuClose={() => setIsMenuOpen(false)}
          />
        </div>
        <p>or</p>
        <div className="new-variable">
          Create new variable:
          <div className="new-variable-inputs inline-row input-entry">
            <label className="label">Name: <input type="text" className="input" /></label>
            <label className="label">Value: <input type="text" className="input" /></label>
          </div>
        </div>
      </div>
    );
  };

  const [showVariableDialog, hideVariableDialog] = useCustomModal({
    className: "variable-dialog",
    title: "Insert Variable",
    Content: ModalContent,
    contentProps: {},
    buttons: [{ label: "Cancel" },{  label: "OK" }],
  }, []);
  return [showVariableDialog, hideVariableDialog];
};
