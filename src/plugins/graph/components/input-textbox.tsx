import React, { useState } from "react";
import { measureText } from "../../../components/tiles/hooks/use-measure-text";

interface IInputTextboxProps {
  defaultValue: string;
  finishEditing: () => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  updateValue: (val: string) => void;
}
export function InputTextbox({ defaultValue, finishEditing, inputRef, updateValue }: IInputTextboxProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  const width = measureText(inputValue) + 2 * 5;
  const inputStyle = { width: `${width}px` };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = e;
    switch (key) {
      case "Enter": {
        updateValue((e.target as HTMLInputElement).value);
        finishEditing();
        break;
      }
      case "Escape":
        finishEditing();
        break;
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = e => {
    updateValue(e.target.value);
    finishEditing();
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = e => {
    setInputValue(e.target.value);
  };

  return (
    <input
      className="input-textbox"
      ref={el => inputRef.current = el}
      onKeyDown={handleKeyDown}
      defaultValue={defaultValue} // Set the initial value
      onBlur={handleBlur}
      onChange={handleChange}
      style={inputStyle}
    />
  );
}
