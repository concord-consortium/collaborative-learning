import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import { kAxisStrokeWidth, kAxisTickLength, kAxisTickPadding } from '../graph-types';
import { AxisPlace } from '../imports/components/axis/axis-types';
import { useAxisLayoutContext } from '../imports/components/axis/models/axis-layout-context';

import NumberlineArrowLeft from "../../../assets/numberline-arrow-left.svg";
import NumberlineArrowRight from "../../../assets/numberline-arrow-right.svg";

import "./axis-end-components.scss";
import { isFiniteNumber } from '../../../utilities/math-utils';

// This component includes a handful of componets that get added to a graph near the end of its left and bottom axes.
// An editable box allows the user to adjust the min or max of the axis.
// An arrowhead is added to the axis convey that the axis continues indefinitely.
// An axis extension is added to connect the d3 axis to the arrowhead when necessary.

// Keep in sync with .editable-border-box height in editable-graph-value.scss
const kEditableBoxHeight = 22;

interface IAxisEndComponentsProps {
  value: number;
  minOrMax: "min" | "max";
  axis: AxisPlace;
  onValueChange: (newValue: number) => void;
  readOnly?: boolean;
}

export const AxisEndComponents: React.FC<IAxisEndComponentsProps> = observer(function AxisEndComponents(props) {
  const { value, minOrMax, axis, onValueChange, readOnly } = props;
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const layout = useAxisLayoutContext();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  const axisBounds = layout.getComputedBounds(axis);
  if (!axisBounds) return null;

  // The editable border box allows the user to change the min or max of each axis
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
      width: `${boxWidth}px`
    };

    // For left axis determine min/max left offset based on axisBounds accounting for boxWidth
    if (axis === 'left') {
      const yTickRightEdgePosition = axisBounds.left + axisBounds.width - kAxisTickLength - kAxisTickPadding;
      const leftOffset = yTickRightEdgePosition - boxWidth;
      style.left = `${leftOffset}px`;
      const topOffsetMin = axisBounds.height + layout.getDesiredExtent("top") - kEditableBoxHeight / 2;
      style.top = minOrMax === 'max' ? `0px` : `${topOffsetMin}px`;
    }

    //For bottom axis place min/max under numberline and for min calc left offset
    if (axis === 'bottom') {
      const xTickTopEdgePosition = axisBounds.top + kAxisTickLength + kAxisTickPadding - 1;
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

  // The arrow adds an arrowhead to the end of the axis.
  const calculateArrowStyle = () => {
    const style: CSSProperties = {};

    if (axis === "bottom") {
      style.top = `${axisBounds.top - 7}`;
      if (minOrMax === "min") {
        style.left = `${axisBounds.left - kAxisTickLength - 5}px`;
      } else {
        style.left = `${axisBounds.left + axisBounds.width - 14}px`;
      }
    }

    if (axis === "left") {
      style.transform = "rotate(-90deg)";
      style.left = `${axisBounds.left + axisBounds.width - 9}`;
      if (minOrMax === "min") {
        style.top = `${axisBounds.top + axisBounds.height + kAxisTickLength - 11}px`;
      } else {
        style.top = `${axisBounds.top - 1}px`;
      }
    }

    return style;
  };
  const arrowStyle = calculateArrowStyle();
  const ArrowSVG = minOrMax === "min" ? NumberlineArrowLeft : NumberlineArrowRight;

  // The axis extension adds a bit of extra axis to connect the d3 axis with the arrowheads.
  // This is only drawn for min, not max.
  const calculateAxisExtensionStyle = () => {
    // The axis only gets extended at the min
    if (minOrMax === "max") return;

    const style: CSSProperties = {};

    if (axis === "bottom") {
      style.left = `${axisBounds.left - kAxisTickLength}px`;
      style.top = `${axisBounds.top - kAxisStrokeWidth / 2}px`;
      style.height = `${kAxisStrokeWidth}px`;
      style.width = `${kAxisTickLength}px`;
    }

    if (axis === "left") {
      style.left = `${axisBounds.left + axisBounds.width - kAxisStrokeWidth / 2}px`;
      style.top = `${axisBounds.top + axisBounds.height}px`;
      style.height = `${kAxisTickLength}px`;
      style.width = `${kAxisStrokeWidth}px`;
    }

    return style;
  };
  const axisExtensionStyle = calculateAxisExtensionStyle();

  const handleClick = () => {
    if (!readOnly && !isEditing) {
      setIsEditing(true);
    }
  };

  const updateValue = (val: string) => {
    if (isFiniteNumber(Number(val))) {
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

  const borderBoxClasses = classNames("editable-border-box", axis);
  return (
    <>
      {axisExtensionStyle && <div className="axis-extension" style={axisExtensionStyle} />}
      <ArrowSVG className="arrow" style={arrowStyle} />
      <div style={borderBoxStyles} className={borderBoxClasses} onClick={handleClick}
        data-testid={`editable-border-box-${axis}-${minOrMax}`}>
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
    </>
  );
});
