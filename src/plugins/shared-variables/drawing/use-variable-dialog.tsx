import React, { useState } from "react";
import Select from "react-select";
import { Variable } from "@concord-consortium/diagram-view";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import { DrawingContentModelType } from "../../drawing-tool/model/drawing-content";
import { VariableChipObjectSnapshot } from "./variable-object";
import { findVariable, getVariables, getOrFindSharedModel } from "./drawing-utils";

import './variable-dialog.scss';

interface IProps {
  drawingContent: DrawingContentModelType;
}

export const useVariableDialog = ({drawingContent}: IProps) => {
  let selectedVariableId: string | undefined = undefined;
  let _variableName: string | undefined = undefined;
  let _variableValue = "";
  let variableChip: VariableChipObjectSnapshot;

  const ModalContent = () => {
    const variables = getVariables(drawingContent);
    const options = variables.map(variable => ({label: variable.name || "no name", value: variable.id }));
    const [, setIsMenuOpen] = useState(false);
    const [variableName, setVariableName] = useState("");
    const [variableValue, setVariableValue] = useState("");
    const [selectedOption, setSelectedOption] = useState<{label: string, value: string } | undefined>(undefined);
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

    const handleSelectChange = (value: any) => {
      selectedVariableId = value?.value;
      const selectedVariable = selectedVariableId && findVariable(drawingContent, selectedVariableId);
      if (selectedVariable) {
        _variableName = selectedVariable.name || "";
        _variableValue = selectedVariable.value?.toString() || "";
        setVariableName(_variableName);
        setVariableValue(_variableValue);
        setSelectedOption(value);
      }
    };
    const handleNameChange = (e: { target: { value: string; }; }) => {
      setVariableName(e.target.value);
      _variableName = e.target.value;
    };
    const handleValueChange = (e: { target: { value: string; }; }) => {
      setVariableValue(e.target.value);
      _variableValue = e.target.value;
    };

    return (
      <div className="content">
        <div className="variable-choices">
          Select existing variable:
          <Select
            name={name}
            styles={customStyles}
            options={options}
            value={selectedOption}
            onChange={handleSelectChange}
            onMenuOpen={() => setIsMenuOpen(true)}
            onMenuClose={() => setIsMenuOpen(false)}
          />
        </div>
        <p>or</p>
        <div className="new-variable">
          Create new variable:
          <div className="new-variable-inputs inline-row input-entry">
            <label className="label">
              Name:
              <input type="text" className="input" id="variable-name-input" value={variableName}
                      onChange={handleNameChange}
              />
            </label>
            <label className="label">
              Value:
              <input type="text" className="input" id="variable-value-input" value={variableValue}
                      onChange={handleValueChange}
              />
            </label>
          </div>
        </div>
      </div>
    );
  };

  const handleClick = () => {
    const selectedVariable = selectedVariableId && findVariable(drawingContent, selectedVariableId);
    let dialogVarId: string | undefined;

    if (!selectedVariable && !_variableName && !_variableValue) {
      return null;
    } else if (!selectedVariable) {
      const sharedModel = getOrFindSharedModel(drawingContent);
      const variable = Variable.create({name: _variableName, value: parseFloat(_variableValue) });
      sharedModel?.addVariable(variable);
      const newVariable = sharedModel?.variables.find(v => v === variable);
      dialogVarId = newVariable?.id;
    } else {
      dialogVarId = selectedVariable.id;
    }
    if (dialogVarId) {
      variableChip = ({
        type: "variable",
        x: 250,
        y: 50,
        variableId: dialogVarId
      });
      drawingContent.applyChange({action: "create", data: variableChip});
    }
    selectedVariableId = undefined;
  };

  const [showVariableDialog, hideVariableDialog] = useCustomModal({
    className: "variable-dialog",
    title: "Insert Variable",
    Content: ModalContent,
    contentProps: {},
    buttons: [{ label: "Cancel" },{  label: "OK", onClick: handleClick }],
  }, []);
  return [showVariableDialog, hideVariableDialog];
};
