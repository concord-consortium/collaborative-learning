import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';

import "./numberline-tile.scss";

interface IEditableMinMaxProps {
  readOnly?: boolean;
  isTileSelected: boolean;
  value: number;
  arrowOffset: number;
  minOrMax: "min" | "max";
  onValueChange: (newValue: number) => void;
}

export const EditableNumberlineMinOrMax: React.FC<IEditableMinMaxProps> = observer(function NumberlineTile(props) {
  const { readOnly, isTileSelected, value, arrowOffset, minOrMax, onValueChange } = props;
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
    }
  };

  const updateValue = (val: string) => {
    if (checkIfNumber(val)) {
      onValueChange(Number(val));
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
  const numCharToOffset = -3 * value.toString().length + 7; //additional offset to center value with tick
  const borderBoxOffset = `${arrowOffset + numCharToOffset}px`;
  const borderBoxStyle = (minOrMax === "min") ? { left: borderBoxOffset } : { right: borderBoxOffset };
  const borderClasses = classNames("border-box", {hide: !isTileSelected});

  return (
    <div className={borderClasses} style={borderBoxStyle} onClick={handleClick}>
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
