import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import { measureText } from '../../../components/tiles/hooks/use-measure-text';
import { isFiniteNumber } from '../../../utilities/math-utils';
import { kAxisStrokeWidth, kAxisTickLength, kAxisTickPadding } from '../graph-types';
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

// Keep in sync with .editable-border-box height in axis-end-components.scss
const kEditableBoxHeight = 22;
// Arrow SVG dimensions — keep in sync with .arrow in axis-end-components.scss
const kArrowWidth = 18;
const kArrowHeight = 14;
// Small overlap so arrows connect visually to the axis line at the max end
const kArrowOverlap = 2;
// Visual adjustment to shift bottom-axis boxes up slightly toward the tick labels
const kBottomBoxTopAdjust = 5;

interface IAxisEndComponentsProps {
  value: number;
  minOrMax: "min" | "max";
  axis: AxisPlace;
  onValueChange: (newValue: number) => void;
  readOnly?: boolean;
  showArrow?: boolean;
  crossAxisZeroPos?: number; // absolute pixel position of zero on the cross-axis
}

export const AxisEndComponents: React.FC<IAxisEndComponentsProps> = observer(function AxisEndComponents(props) {
  const { value, minOrMax, axis, onValueChange, readOnly, showArrow = true, crossAxisZeroPos } = props;
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const borderBoxRef = useRef<HTMLDivElement | null>(null);
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
      style.top = minOrMax === 'max'
        ? `${axisBounds.top - kEditableBoxHeight / 2}px`
        : `${topOffsetMin}px`;
    }

    //For bottom axis place min/max under numberline and for min calc left offset
    if (axis === 'bottom') {
      const xTickTopEdgePosition = axisBounds.top + kAxisTickLength + kAxisTickPadding - kBottomBoxTopAdjust;
      style.top = `${xTickTopEdgePosition}px`;
      if (minOrMax === 'min') {
        const leftOffset = axisBounds.left - (boxWidth / 2);
        style.left = `${leftOffset}px`;
      } else {
        style.left = `${axisBounds.left + axisBounds.width - boxWidth / 2}px`;
      }
    }

    return style;
  };
  const borderBoxStyles = calculateBorderBoxStyles();

  // The arrow adds an arrowhead to the end of the axis.
  // When crossAxisZeroPos is provided, arrows move to the zero-axis position.
  const calculateArrowStyle = () => {
    const style: CSSProperties = {};

    if (axis === "bottom") {
      const topPos = crossAxisZeroPos ?? axisBounds.top;
      style.top = `${topPos - kArrowHeight / 2}`;
      if (minOrMax === "min") {
        style.left = `${axisBounds.left - kAxisTickLength - kArrowOverlap}px`;
      } else {
        style.left = `${axisBounds.left + axisBounds.width - kArrowOverlap}px`;
      }
    }

    if (axis === "left") {
      style.transform = "rotate(-90deg)";
      const leftPos = crossAxisZeroPos ?? (axisBounds.left + axisBounds.width);
      style.left = `${leftPos - kArrowWidth / 2}`;
      if (minOrMax === "min") {
        style.top = `${axisBounds.top + axisBounds.height + kAxisTickLength - kArrowHeight}px`;
      } else {
        style.top = `${axisBounds.top - kArrowHeight + kArrowOverlap}px`;
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
      const topPos = crossAxisZeroPos ?? axisBounds.top;
      style.left = `${axisBounds.left - kAxisTickLength}px`;
      style.top = `${topPos - kAxisStrokeWidth / 2}px`;
      style.height = `${kAxisStrokeWidth}px`;
      style.width = `${kAxisTickLength}px`;
    }

    if (axis === "left") {
      const leftPos = crossAxisZeroPos ?? (axisBounds.left + axisBounds.width);
      style.left = `${leftPos - kAxisStrokeWidth / 2}px`;
      style.top = `${axisBounds.top + axisBounds.height}px`;
      style.height = `${kAxisTickLength}px`;
      style.width = `${kAxisStrokeWidth}px`;
    }

    return style;
  };
  const axisExtensionStyle = calculateAxisExtensionStyle();

  const startEditing = () => {
    if (!readOnly && !isEditing) {
      setIsEditing(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Enter" || e.key === " ") && !readOnly) {
      e.preventDefault();
      e.stopPropagation();
      startEditing();
    }
  };

  const updateValue = (val: string) => {
    if (isFiniteNumber(Number(val))) {
      onValueChange(Number(val));
    }
  };

  const borderBoxClasses = classNames("editable-border-box", axis);
  const axisName = (axis === "left" || axis === "rightNumeric") ? "Y-axis" : "X-axis";
  const boundName = minOrMax === "min" ? "minimum" : "maximum";
  const ariaLabel = readOnly
    ? `${axisName} ${boundName}: ${value}`
    : `${axisName} ${boundName}: ${value}, press Enter to edit`;
  return (
    <>
      {showArrow && axisExtensionStyle && <div className="axis-extension" style={axisExtensionStyle} />}
      {showArrow && <ArrowSVG className="arrow" style={arrowStyle} />}
      <div
        ref={borderBoxRef}
        style={borderBoxStyles}
        className={borderBoxClasses}
        onClick={startEditing}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        data-testid={`editable-border-box-${axis}-${minOrMax}`}
      >
        { isEditing ?
          <InputTextbox
            defaultValue={value.toString()}
            finishEditing={() => setIsEditing(false)}
            inputRef={inputRef}
            triggerRef={borderBoxRef}
            updateValue={updateValue}
          /> :
          <div>{value}</div>
        }
      </div>
    </>
  );
});
