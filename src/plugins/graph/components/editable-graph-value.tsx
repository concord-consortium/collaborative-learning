import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect } from 'react';
import { AxisPlace } from '../imports/components/axis/axis-types';
import classNames from 'classnames';

import "./editable-graph-value.scss";

interface IEditableValueProps {
  value: number;
  minOrMax: "min" | "max";
  axis: AxisPlace;
  onValueChange: (newValue: number) => void;
  readOnly?: boolean;
}


export const EditableGraphValue: React.FC<IEditableValueProps> = observer(function EditableGraphValue(props) {
  const { value, minOrMax, axis, onValueChange, readOnly } = props;
  // console.log("📁 editable-graph-value.tsx ------------------------");
  // console.log("\t🏭 EditableGraphValue");
  // console.log("\t🥩 axis:", axis);
  // console.log("\t🥩 minOrMax:", minOrMax);
  // console.log("\t🥩 value:", value);

  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const borderBoxRef = useRef<HTMLInputElement | null>(null);
  const yAxisRef = useRef(null); // Ref for the Y-axis


  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  // Calculate the width of the border box (and Y axis left offset) depending on how many characters are in value
  useEffect(() => {
    if (borderBoxRef.current) {
      const numOfCharacters = value.toString().length;
      const widthPerCharacter = 8;
      let newWidth: number;
      if (numOfCharacters === 1){
        newWidth = 15;
      } else if (numOfCharacters === 2){
        newWidth = 20;
      } else {
        newWidth = value.toString().length * widthPerCharacter;
      }
      borderBoxRef.current.style.width = `${newWidth}px`;

      // Calculate the left offset for left-min and left-max based on how many characters are in value

      if (axis === 'left' && (minOrMax === 'min' || minOrMax === 'max')) {
        const baseOffset = 45; // The base left offset
        const newLeftOffset = baseOffset - newWidth; // Subtract newWidth from baseOffset
        console.log("\t🏭 newLeftOffset", newLeftOffset);
        borderBoxRef.current.style.left = `${newLeftOffset}px`;
      }

    }
  }, [value, axis, minOrMax]);


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

  const borderClasses = classNames("editable-border-box", `${axis}-${minOrMax}`);

  return (
    <div ref={borderBoxRef} className={borderClasses} onClick={handleClick}>
      {isEditing ? (
        <input
          className="input-textbox"
          ref={(el) => {
            inputRef.current = el;
          }}
          onKeyDown={handleKeyDown}
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
