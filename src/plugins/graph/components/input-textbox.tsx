import React, { useEffect, useRef, useState } from "react";
import { measureText } from "../../../components/tiles/hooks/use-measure-text";

interface IInputTextboxProps {
  defaultValue: string;
  finishEditing: () => void;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  setWidth?: (width: number) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  updateValue: (val: string) => void;
}
export function InputTextbox({
  defaultValue, finishEditing, inputRef, setWidth, triggerRef, updateValue
}: IInputTextboxProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const cancellingRef = useRef(false);

  const width = measureText(inputValue) + 2 * 5;
  const inputStyle = { width: `${width}px` };

  useEffect(() => {
    setWidth?.(width);
  }, [setWidth, width]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = e;
    if (key === "Enter") {
      updateValue((e.target as HTMLInputElement).value);
      finishEditing();
      triggerRef?.current?.focus();
    } else if (key === "Escape") {
      e.preventDefault();
      cancellingRef.current = true;
      finishEditing();
      triggerRef?.current?.focus();
    }
    e.stopPropagation();
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = e => {
    if (cancellingRef.current) {
      cancellingRef.current = false;
      return;
    }
    updateValue(e.target.value);
    finishEditing();
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = e => {
    setInputValue(e.target.value);
  };

  return (
    <input
      className="input-textbox"
      ref={el => {
        if (inputRef) {
          inputRef.current = el;
        }
      }}
      onKeyDown={handleKeyDown}
      defaultValue={defaultValue} // Set the initial value
      onBlur={handleBlur}
      onChange={handleChange}
      style={inputStyle}
    />
  );
}
