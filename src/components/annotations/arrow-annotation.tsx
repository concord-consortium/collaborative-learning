import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";

import { ArrowAnnotationType } from "../../models/annotations/arrow-annotation";
import { ClueObjectType } from "../../models/annotations/clue-object";

import "./arrow-annotation.scss";

interface IArrowAnnotationProps {
  arrow: ArrowAnnotationType;
  canEdit?: boolean;
  getBoundingBox: (object: ClueObjectType) =>
    { height: number, left: number, top: number, width: number} | null | undefined;
  key?: string;
}
export const ArrowAnnotationComponent = observer(
  function ArrowAnnotationComponent({ arrow, canEdit, getBoundingBox }: IArrowAnnotationProps) {
    const [editingText, setEditingText] = useState(false);
    const [tempText, setTempText] = useState(arrow.text ?? "");
    const inputRef = useRef<HTMLInputElement|null>(null);
    useEffect(() => {
      // Focus on the text input when we start editing
      if (editingText) {
        inputRef.current?.focus();
      }
    }, [editingText]);

    if (!arrow.sourceObject || !arrow.targetObject) return null;

    // Find bounding boxes for source and target objects
    const sourceBB = getBoundingBox(arrow.sourceObject);
    const targetBB = getBoundingBox(arrow.targetObject);
    if (!sourceBB || !targetBB) return null;

    // Find positions for head and tail of arrow
    const sourceX = sourceBB.left + sourceBB.width / 2;
    const sourceY = sourceBB.top + sourceBB.height / 2;
    const targetX = targetBB.left + targetBB.width / 2;
    const targetY = targetBB.top + targetBB.height / 2;
    
    // Determine angle of arrowhead
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const angle = 90-Math.atan2(-dy, dx)*180/Math.PI;

    // Set up text location and dimensions
    const textWidth = 120;
    const textHeight = 50;
    const textX = targetX - dx / 2 - textWidth / 2;
    const textY = targetY - dy / 2 - textHeight / 2;

    // Set up text handlers
    function acceptText() {
      arrow.setText(tempText);
      setEditingText(false);
    }
    function rejectText() {
      setTempText(arrow.text ?? "");
      setEditingText(false);
    }
    function handleBlur() {
      acceptText();
    }
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      setTempText(e.target.value);
    }
    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      const { key } = e;
      switch (key) {
        case "Escape":
          rejectText();
          break;
        case "Enter":
        case "Tab":
          acceptText();
          break;
      }
    }

    const color = "blue";
    return (
      <>
        <path d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`} stroke={color} strokeWidth={3} />
        <g transform={`translate(${targetX} ${targetY}) rotate(${angle})`}>
          <polygon points="0 -3 7 12 -7 12 0 -3" fill={color} />
        </g>
        <foreignObject height={`${textHeight}`} width={`${textWidth}`} x={`${textX}`} y={`${textY}`}>
          <div className="text-region">
            { editingText
              ? (
                <input
                  className="text-input"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  ref={inputRef}
                  type="text"
                  value={tempText}
                />
              ) : (
                <button
                  className={classNames("text-display", { "can-edit": canEdit })}
                  onClick={() => canEdit && setEditingText(true)}
                >
                  {arrow.text?.trim() || "Click to enter text"}
                </button>
              )
            }
          </div>
        </foreignObject>
      </>
    );
  }
);
