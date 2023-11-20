import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect } from 'react';
import { AxisPlace } from '../imports/components/axis/axis-types';
import classNames from 'classnames';

import "./editable-graph-value.scss";

interface IEditableValueProps {
  value: number;
  minOrMax: "min" | "max";
  axis: AxisPlace
  onValueChange: (newValue: number) => void;
}



export const EditableGraphValue: React.FC<IEditableValueProps> = observer(function NumberlineTile(props) {
  const { value, minOrMax, axis, onValueChange } = props;
  //TODO: readOnly? Parent is <Graph> and readOnly is NOT passed in as a prop
  // isTileSelected?: boolean;
  const readOnly = false; //for now
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

  const borderClasses = classNames("editable-border-box", `${axis}-${minOrMax}`);

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
