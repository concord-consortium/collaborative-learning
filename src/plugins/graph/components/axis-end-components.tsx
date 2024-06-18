import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import { measureText } from '../../../components/tiles/hooks/use-measure-text';
import { isFiniteNumber } from '../../../utilities/math-utils';
import { kAxisStrokeWidth, kAxisTickLength, kAxisTickPadding, kTopAndRightDefaultExtent } from '../graph-types';
import { AxisPlace } from '../imports/components/axis/axis-types';
import { useAxisLayoutContext } from '../imports/components/axis/models/axis-layout-context';
import { InputTextbox } from './input-textbox';

import NumberlineArrowLeft from "../../../assets/numberline-arrow-left.svg";
import NumberlineArrowRight from "../../../assets/numberline-arrow-right.svg";

import "./axis-end-components.scss";

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
    const minWidth = 25;
    const boxHorizontalPadding = 4;
    const boxFont = "14px sans-serif";
    const textWidth = measureText(value.toString(), boxFont);
    const boxWidth = Math.max(textWidth + 2 * boxHorizontalPadding, minWidth);

    const style: CSSProperties = {
      width: `${boxWidth}px`
    };

    // For left axis determine min/max left offset based on axisBounds accounting for boxWidth
    if (axis === 'left') {
      const yTickRightEdgePosition = axisBounds.left + axisBounds.width - kAxisTickLength - kAxisTickPadding;
      const leftOffset = yTickRightEdgePosition - boxWidth + boxHorizontalPadding;
      style.left = `${leftOffset}px`;
      const topOffsetMin = axisBounds.height + layout.getDesiredExtent("top") - kEditableBoxHeight / 2;
      style.top = minOrMax === 'max' ? `${kTopAndRightDefaultExtent}px` : `${topOffsetMin}px`;
    }

    //For bottom axis place min/max under numberline and for min calc left offset
    if (axis === 'bottom') {
      const xTickTopEdgePosition = axisBounds.top + kAxisTickLength + kAxisTickPadding - 5;
      style.top = `${xTickTopEdgePosition}px`;
      if (minOrMax === 'min') {
        const leftOffset = axisBounds.left - (boxWidth / 2);
        style.left = `${leftOffset}px`;
      } else {
        style.right = `${kTopAndRightDefaultExtent}px`;
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
        style.left = `${axisBounds.left - kAxisTickLength - 2}px`;
      } else {
        style.left = `${axisBounds.left + axisBounds.width - 14}px`;
      }
    }

    if (axis === "left") {
      style.transform = "rotate(-90deg)";
      style.left = `${axisBounds.left + axisBounds.width - 9}`;
      if (minOrMax === "min") {
        style.top = `${axisBounds.top + axisBounds.height + kAxisTickLength - 14}px`;
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
  };

  const borderBoxClasses = classNames("editable-border-box", axis);
  return (
    <>
      {axisExtensionStyle && <div className="axis-extension" style={axisExtensionStyle} />}
      <ArrowSVG className="arrow" style={arrowStyle} />
      <div style={borderBoxStyles} className={borderBoxClasses} onClick={handleClick}
        data-testid={`editable-border-box-${axis}-${minOrMax}`}>
        { isEditing ?
          <InputTextbox
            defaultValue={value.toString()}
            finishEditing={() => setIsEditing(false)}
            inputRef={inputRef}
            updateValue={updateValue}
          /> :
          <div>{value}</div>
        }
      </div>
    </>
  );
});
