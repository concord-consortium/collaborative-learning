import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";

import { CurvedArrow } from "./curved-arrow";
import { IArrowAnnotation } from "../../models/annotations/arrow-annotation";
import { IClueObject } from "../../models/annotations/clue-object";

import "./arrow-annotation.scss";

type DragType = "source" | "target" | "text";
interface IArrowAnnotationProps {
  arrow: IArrowAnnotation;
  canEdit?: boolean;
  getBoundingBox: (object: IClueObject) =>
    { height: number, left: number, top: number, width: number} | null | undefined;
  key?: string;
}
export const ArrowAnnotationComponent = observer(
  function ArrowAnnotationComponent({ arrow, canEdit, getBoundingBox }: IArrowAnnotationProps) {
    const [firstClick, setFirstClick] = useState(false);
    const [editingText, setEditingText] = useState(false);
    const [tempText, setTempText] = useState(arrow.text ?? "");
    const inputRef = useRef<HTMLInputElement|null>(null);
    useEffect(() => {
      // Focus on the text input when we start editing
      if (editingText) {
        inputRef.current?.focus();
      }
    }, [editingText]);

    // State used for dragging to move source, target, and text
    const [clientX, setClientX] = useState<number|undefined>();
    const [clientY, setClientY] = useState<number|undefined>();
    const [dragType, setDragType] = useState<DragType|undefined>();
    const [dragX, setDragX] = useState<number|undefined>();
    const [dragY, setDragY] = useState<number|undefined>();
    const dragDx = clientX !== undefined && dragX !== undefined ? clientX - dragX : 0;
    const dragDy = clientY !== undefined && dragY !== undefined ? clientY - dragY : 0;
    const dragging = clientX !== undefined && clientY !== undefined && dragX !== undefined && dragY !== undefined;
    const [sourceDragOffsetX, sourceDragOffsetY] = dragging && dragType === "source" ? [dragDx, dragDy] : [0, 0];
    const [targetDragOffsetX, targetDragOffsetY] = dragging && dragType === "target" ? [dragDx, dragDy] : [0, 0];
    const [textDragOffsetX, textDragOffsetY] = dragging && dragType === "text" ? [dragDx, dragDy] : [0, 0];

    // Bail if there is no source or target
    if (!arrow.sourceObject || !arrow.targetObject) return null;

    // Find bounding boxes for source and target objects
    const sourceBB = getBoundingBox(arrow.sourceObject);
    const targetBB = getBoundingBox(arrow.targetObject);
    if (!sourceBB || !targetBB) return null;

    // Find positions for head and tail of arrow
    const [sDxOffset, sDyOffset] = arrow.sourceOffset ? [arrow.sourceOffset.dx, arrow.sourceOffset.dy] : [0, 0];
    const sourceX = sourceBB.left + sourceBB.width / 2 + sDxOffset + sourceDragOffsetX;
    const sourceY = sourceBB.top + sourceBB.height / 2 + sDyOffset + sourceDragOffsetY;
    const [tDxOffset, tDyOffset] = arrow.targetOffset ? [arrow.targetOffset.dx, arrow.targetOffset.dy] : [0, 0];
    const targetX = targetBB.left + targetBB.width / 2 + tDxOffset + targetDragOffsetX;
    const targetY = targetBB.top + targetBB.height / 2 + tDyOffset + targetDragOffsetY;

    // Set up text location and dimensions
    const textWidth = 120;
    const textHeight = 50;
    const [textDxOffset, textDyOffset] = arrow.textOffset ? [arrow.textOffset.dx, arrow.textOffset.dy] : [0, 0];
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const textX = targetX - dx / 2 - textWidth / 2 + textDxOffset + textDragOffsetX;
    const textY = targetY - dy / 2 - textHeight / 2 + textDyOffset + textDragOffsetY;

    // Set up text handlers
    function handleTextClick() {
      if (!canEdit) return;

      if (firstClick) {
        setEditingText(true);
        setFirstClick(false);
      } else {
        setFirstClick(true);
        setTimeout(() => setFirstClick(false), 500);
      }
    }
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

    // Set up drag handlers
    const dragHandlerHeight = 10;
    const dragHandlerWidth = 10;
    function handleMouseDown(e: React.MouseEvent<SVGRectElement|HTMLButtonElement, MouseEvent>, _dragType: DragType) {
      if (!canEdit) return;

      setDragX(e.clientX);
      setDragY(e.clientY);
      setDragType(_dragType);

      function handleMouseMove(e2: MouseEvent) {
        setClientX(e2.clientX);
        setClientY(e2.clientY);
      }
      function handleMouseUp(e2: MouseEvent) {
        const startingOffset =
          _dragType === "source" ? arrow.sourceOffset
          : _dragType === "target" ? arrow.targetOffset
          : arrow.textOffset;
        const [startingDx, startingDy] = startingOffset ? [startingOffset.dx, startingOffset.dy] : [0, 0];
        const setFunc =
          _dragType === "source" ? arrow.setSourceOffset
          : _dragType === "target" ? arrow.setTargetOffset
          : arrow.setTextOffset;
        const dDx = e2.clientX - e.clientX;
        const dDy = e2.clientY - e.clientY;
        setFunc(startingDx + dDx, startingDy + dDy);
  
        setClientX(undefined);
        setClientY(undefined);
        setDragX(undefined);
        setDragY(undefined);
        setDragType(undefined);
  
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      }

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    interface IDragHandlerProps {
      startX: number;
      startY: number;
      target: "source" | "target";
    }
    function DragHandler({ startX, startY, target }: IDragHandlerProps) {
      return (
        <rect
          className="drag-handle"
          fill="transparent"
          height={dragHandlerHeight}
          onMouseDown={e => handleMouseDown(e, target)}
          width={dragHandlerWidth}
          x={startX - dragHandlerWidth / 2}
          y={startY - dragHandlerHeight / 2}
        />
      );
    }
    return (
      <g>
        <CurvedArrow sourceX={sourceX} sourceY={sourceY} targetX={targetX} targetY={targetY} />
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
                  onClick={handleTextClick}
                  onMouseDown={e => handleMouseDown(e, "text")}
                >
                  {arrow.text?.trim() || "Click to enter text"}
                </button>
              )
            }
          </div>
        </foreignObject>
        <DragHandler startX={sourceX} startY={sourceY} target="source" />
        <DragHandler startX={targetX} startY={targetY} target="target" />
      </g>
    );
  }
);
