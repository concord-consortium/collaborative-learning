import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';

import "./numberline-tile.scss";

interface IEditableValueProps {
  readOnly?: boolean;
  isTileSelected: boolean;
  value: number;
  arrowOffset: number;
  minOrMax: "min" | "max";
  onValueChange: (newValue: number) => void;
}

export const EditableNumberlineValue: React.FC<IEditableValueProps> = observer(function NumberlineTile(props) {
  const { readOnly, isTileSelected, value, arrowOffset, minOrMax, onValueChange } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Update input value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString());
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!readOnly && !isEditing) {
      setIsEditing(true);
    }
  };

  const handleFocus = () => {
    if (!readOnly && !isEditing) {
      setInputValue(value.toString());
      setIsEditing(true);
    }
  };

  const commitValue = () => {
    if (checkIfNumber(inputValue)) {
      onValueChange(Number(inputValue));
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const { key } = e;
    switch (key) {
      case "Enter": {
        e.preventDefault();
        e.stopPropagation();
        commitValue();
        break;
      }
      case "Escape":
        setInputValue(value.toString());
        setIsEditing(false);
        break;
      case "Tab":
        // Commit and allow natural tab progression
        commitValue();
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
  const minOrMaxWord = minOrMax === "min" ? "Minimum" : "Maximum";

  return (
    <div
      ref={containerRef}
      className={borderClasses}
      style={borderBoxStyle}
      onClick={handleClick}
      onFocus={handleFocus}
      tabIndex={readOnly ? -1 : 0}
      role="button"
      aria-label={`${minOrMaxWord} value: ${value}. ${readOnly ? "" : "Press Enter to edit."}`}
    >
      {isEditing ? (
        <input
          className="input-textbox"
          ref={(el) => {
            inputRef.current = el;
          }}
          onKeyDown={handleKeyDown}
          value={inputValue}
          onBlur={commitValue}
          aria-label={`${minOrMaxWord} value`}
          onChange={(e) => {
            setInputValue(e.target.value);
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
