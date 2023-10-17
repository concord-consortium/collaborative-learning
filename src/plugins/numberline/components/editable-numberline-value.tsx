import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect } from 'react';

import "./numberline-tile.scss";

interface IEditableValueProps {
  readOnly?: boolean;
  isTileSelected: boolean;
  value: number;
  offset: number;
  minOrMax: "min" | "max";
  onValueChange: (newValue: number) => void;
}

export const EditableNumberlineValue: React.FC<IEditableValueProps> = observer(function NumberlineTile(props) {
  const { readOnly, isTileSelected, value, offset, minOrMax, onValueChange } = props;

  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!readOnly && !isEditing) {
      setIsEditing(true);
      // Check if the input element exists before focusing and selecting
      if (inputRef.current) {
        inputRef.current.select();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let inputField = undefined;
    let numberEntered = undefined;
    const { key } = e;
    switch (key) {
      case "Enter":
        inputField = (e.target as HTMLInputElement).value;
        if (checkIfNumber(inputField)){
          numberEntered = Number(inputField);
          onValueChange(numberEntered);
        }
        setIsEditing(false);
        break;
      case "Escape":
      case "Tab":
        setIsEditing(false);
        break;
    }
  };

  const checkIfNumber = (input: string): boolean => {
    const result = Number(input);
    const isNumeric = !isNaN(result) && isFinite(result);
    return isNumeric;
  };

  //----------------------- Determine Styling for Border Box -----------------------

  const borderBoxOffset = `${offset + 4}px`;
  const hideBorderAndResetBackground = !isTileSelected;
  const borderBoxPositionProperty = minOrMax === "min" ? { left: borderBoxOffset } : { right: borderBoxOffset };
  const borderBoxBorderProperty = hideBorderAndResetBackground ? { border: "none" } : { border: "1.5px solid #949494" };
  const borderBoxBackgroundProperty = hideBorderAndResetBackground ? { backgroundColor: "white" }
                                                                   : { backgroundColor: "#f0f9fb" };
  const borderBoxStyle = { ...borderBoxPositionProperty, ...borderBoxBorderProperty, ...borderBoxBackgroundProperty };

  return (
    <div className="border-box" style={borderBoxStyle} onClick={handleClick}>
      {isEditing ? (
        <input
          className="input-textbox"
          ref={(el) => {
            inputRef.current = el;
          }}
          onKeyDown={(e) => handleKeyDown(e)}
          defaultValue={value.toString()} // Set the initial value
          onBlur={(e) => {
            if (checkIfNumber((e.target as HTMLInputElement).value)){
              onValueChange(Number((e.target as HTMLInputElement).value));
            }
            setIsEditing(false);
          }}
          onChange={(e) => {
            // Set the width of the input based on the length of the input value
            if (inputRef.current) {
              inputRef.current.style.width = `${Math.max(5, e.target.value.length)}ch`;
            }
          }}
        />
      ) : (
        <div>{value}</div>
      )}
    </div>
  );
});

export default EditableNumberlineValue;
