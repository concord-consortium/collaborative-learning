import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect } from 'react';

import "./editable-graph-value.scss";
import classNames from 'classnames';

interface IEditableValueProps {
  value: number;
  minOrMax: "min" | "max";
  leftOrBottom?: "left" | "bottom";
  onValueChange?: (newValue: number) => void;
}

//look into readOnly? Parent is <Graph> and readOnly is NOT passed in as a prop
// isTileSelected?: boolean;


export const EditableGraphValue: React.FC<IEditableValueProps> = observer(function NumberlineTile(props) {
  const { value, minOrMax, leftOrBottom, onValueChange } = props;

  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    // if (!readOnly && !isEditing) {
    //   setIsEditing(true);
    // }
    console.log("click!");
  };

  const updateValue = (val: string) => {
    if (checkIfNumber(val)) {
      // onValueChange(Number(val));
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = e;
    switch (key) {
      case "Enter": {
        updateValue((e.target as HTMLInputElement).value);
        break;
      }
      case "Escape":
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
  // const borderBoxOffset = `${offset + 4}px`;
  // const borderBoxStyle = (minOrMax === "min") ? { left: borderBoxOffset } : { right: borderBoxOffset };
  // const borderClasses = classNames("editable-border-box", {hide: !isTileSelected});
  const borderClasses = classNames("editable-border-box", {bottom: true});

  return (
    <div className={borderClasses} onClick={handleClick}>
      {isEditing ? (
        <input
          className="input-textbox"
          ref={(el) => {
            inputRef.current = el;
          }}
          onKeyDown={(e) => handleKeyDown(e)}
          defaultValue={value.toString()} // Set the initial value
          onBlur={(e) => updateValue(e.target.value)}
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
