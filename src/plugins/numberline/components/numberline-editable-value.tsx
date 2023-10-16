import { observer } from 'mobx-react';
import React, { useState } from 'react';

import "./numberline-tile.scss";

interface IEditableValueProps {
  axisWidth: number;
  readOnly?: boolean;
  isTileSelected: boolean;
  value: number;
  minOrMax: "min" | "max";
  // onBeginEdit?: () => void;
}

export const EditableNumberlineValue: React.FC<IEditableValueProps> = observer(function NumberlineTile(props){
  const { axisWidth, readOnly, isTileSelected, value, minOrMax } = props;
  // if (!readOnly)   console.log("📁 numberline-editable-value.tsx ------------------------");
  // if (!readOnly) console.log("\t🥩 readOnly:", readOnly);
  // if (!readOnly) console.log("\t🥩 minOrMax:", minOrMax);

  const [isEditing, setIsEditing] = useState(false);

  const handleClick = () => {
    if (!readOnly && !isEditing) {
      console.log("\t🏭 handleClick");
      setIsEditing(true);
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //if it's not readOnly
    if (!readOnly){
      const inputValue = e.target.value; // Get the typed value from the input field
      console.log("\t🥩 inputValue:", inputValue);
      // setEditingValue(inputValue); // Update the state with the typed value

    }
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    console.log("handleKeyDown");
    const { key } = e;
    switch (key) {
      case "Escape":
        handleClose(false);
        break;
      case "Enter":
      case "Tab":
        handleClose(true);
        break;
    }
  };


  const handleClose = (accept: boolean) => {
    console.log("\t🏭 handleClose");
    setIsEditing(false);
  };

  const autoFocusAndSelect = (input: HTMLInputElement | null) => {
    input?.focus();
    input?.select();
  };


  const leftPosition = `${(axisWidth * (0.01)).toFixed(2)}px`;
  const containerStyle: React.CSSProperties = { left: `${leftPosition}`};

  return (
    <div
      className={`${minOrMax}-box`}
      style={containerStyle}
      onClick={handleClick}
    >
      {
        isEditing
        ?
        <input
          className="min-textbox"
          ref={autoFocusAndSelect}
          onKeyDown={handleKeyDown}
          onChange={(event) => handleChange(event)}
          onBlur={() => handleClose(true)}
        />

        :
        <div className="editable-value">{value}</div>
      }
    </div>
  );
});

export default EditableNumberlineValue;
