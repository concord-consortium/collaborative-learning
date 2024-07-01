import React, { PropsWithChildren } from "react";

interface LabelRadioButtonProps {
  display: string;
  label: string;
  checkedLabel: string;
  setLabelOption: React.Dispatch<React.SetStateAction<string>>;
}
export const LabelRadioButton = function (
    {display, label, checkedLabel, setLabelOption, children}: PropsWithChildren<LabelRadioButtonProps>) {
  return (
    <div className="radio-button-container">
      <input
        className="radio-button"
        type="radio"
        id={label}
        name="labelOption"
        value={label}
        checked={label === checkedLabel}
        onChange={e => {
          if (e.target.checked) {
            setLabelOption(e.target.value);
          }
        }}
      />
      <label htmlFor={label}>
        {display}
      </label>
      {children}
    </div>
  );
};
