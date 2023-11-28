import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect } from 'react';
import { AxisBounds, AxisPlace } from '../imports/components/axis/axis-types';
import { useAxisLayoutContext } from '../imports/components/axis/models/axis-layout-context';

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
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const borderBoxRef = useRef<HTMLInputElement | null>(null);
  const layout = useAxisLayoutContext();
  const axisBounds = layout.getComputedBounds(axis) as AxisBounds;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  //**************  Dynamically calculate border box size and offset positions ******************
  useEffect(() => {
    if (borderBoxRef.current) {
      // Calculate the width of the border box (and Y axis left offset) depending on how many characters are in value
      const numOfCharacters = value.toString().length;
      const widthPerCharacter = 8;
      let boxWidth: number;
      if (numOfCharacters === 1){
        boxWidth = 15;
      } else if (numOfCharacters === 2){
        boxWidth = 20;
      } else {
        boxWidth = value.toString().length * widthPerCharacter;
      }
      borderBoxRef.current.style.width = `${boxWidth}px`;

      // For left axis determine min/max left offset based on axisBounds and width of border box
      let leftOffset;
      if (axis === 'left') {
        const yTickRightEdgePosition = axisBounds.width - 6; //represents right edge of each Y tick
        leftOffset = yTickRightEdgePosition - boxWidth;
        borderBoxRef.current.style.left = `${leftOffset}px`;
        //position max at top and min such that bottom edge of it's border is at x-axis
        borderBoxRef.current.style.top = (minOrMax === 'max') ? `0px` : `${(axisBounds.height - 22)}px`;
      }

      //For bottom axis place min and max top then calculate left offset for min
      if(axis === 'bottom'){
        const xTickTopEdgePosition = axisBounds.top + 2; //represents right edge of each Y tick
        borderBoxRef.current.style.top = `${xTickTopEdgePosition}px`;
        if (minOrMax === 'min'){
          leftOffset = axisBounds.left - (boxWidth/2);
          borderBoxRef.current.style.left = `${leftOffset}px`;
        } else {
          borderBoxRef.current.style.right = `0px`;
        }
      }
    }
  }, [value, axis, minOrMax, axisBounds]);

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

  return (
    <div ref={borderBoxRef} className={"editable-border-box"} onClick={handleClick}>
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
