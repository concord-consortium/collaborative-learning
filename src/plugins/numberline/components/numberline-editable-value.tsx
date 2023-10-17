import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect } from 'react';

import "./numberline-tile.scss";

interface IEditableValueProps {
  axisWidth: number;
  readOnly?: boolean;
  isTileSelected: boolean;
  value: number;
  offset: number;
  minOrMax: "min" | "max";
  onValueChange: (newValue: string) => void;
}

export const EditableNumberlineValue: React.FC<IEditableValueProps> = observer(function NumberlineTile(props) {
  const { axisWidth, readOnly, isTileSelected, value, offset, minOrMax, onValueChange } = props;

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
        console.log("\t🏭 handleClick");
        inputRef.current.select();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = e;
    switch (key) {
      case "Escape":
        handleClose(false);
        break;
      case "Enter":
        console.log("\t pressed enter!");
        onValueChange((e.target as HTMLInputElement).value);
        e.currentTarget.blur(); // Unselect the text field
        break;
      case "Tab":
        handleClose(true);
        break;
    }
  };

  const handleClose = (accept: boolean) => {
    console.log("\t🏭 handleClose");
    console.log("\t🥩 accept:", accept);
    setIsEditing(false);
  };

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
          onBlur={() => handleClose(true)}
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
