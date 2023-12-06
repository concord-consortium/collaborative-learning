import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect, CSSProperties } from 'react';
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
  const layout = useAxisLayoutContext();
  const axisBounds = layout.getComputedBounds(axis) as AxisBounds;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  //**************  Calculate border box size and offset positions ******************

  const calculateBorderBoxStyles = () => {
    const numOfCharacters = value.toString().length;
    const widthPerCharacter = 8;
    let boxWidth: number;
    // Calculate boxWidth based on the number of characters
    if (numOfCharacters === 1) {
      boxWidth = 15;
    } else if (numOfCharacters === 2) {
      boxWidth = 20;
    } else {
      boxWidth = numOfCharacters * widthPerCharacter;
    }

    const style: CSSProperties = {
      width: `${boxWidth}px`,
      justifyContent: axis === 'bottom' ? 'center' : 'flex-end',
    };

    // For left axis determine min/max left offset based on axisBounds accounting for boxWidth
    if (axis === 'left') {
      const yTickRightEdgePosition = axisBounds.left + axisBounds.width - 7;
      const leftOffset = yTickRightEdgePosition - boxWidth;
      const topOffsetMin = axisBounds.height - 22;
      style.left = `${leftOffset}px`;
      style.top = minOrMax === 'max' ? `0px` : `${topOffsetMin}px`;
    }

    //For bottom axis place min/max under numberline and for min calc left offset
    if (axis === 'bottom') {
      const xTickTopEdgePosition = axisBounds.top + 2;
      style.top = `${xTickTopEdgePosition}px`;
      if (minOrMax === 'min') {
        const leftOffset = axisBounds.left - (boxWidth / 2);
        style.left = `${leftOffset}px`;
      } else {
        style.right = `0px`;
      }
    }

    return style;
  };
  const borderBoxStyles = calculateBorderBoxStyles();

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
    <div style={borderBoxStyles} className={"editable-border-box"} onClick={handleClick}>
      { isEditing ?
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
        /> :
        <div>{value}</div>
      }
    </div>
  );
});
