import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";

import { AnnotationNode } from "./annotation-node";
import { getCurve, kAnnotationNodeHeight, kAnnotationNodeWidth } from "./annotation-utilities";
import { CurvedArrow } from "./curved-arrow";
import { IArrowAnnotation } from "../../models/annotations/arrow-annotation";
import { IClueObject } from "../../models/annotations/clue-object";

import DeleteButton from "../../assets/icons/annotations/delete-button.svg";

import "./arrow-annotation.scss";

type DragType = "source" | "target" | "text";
interface IArrowAnnotationProps {
  arrow: IArrowAnnotation;
  canEdit?: boolean;
  deleteArrow: (arrowId: string) => void;
  getBoundingBox: (object: IClueObject) =>
    { height: number, left: number, top: number, width: number} | null | undefined;
  key?: string;
  readOnly?: boolean;
}
export const ArrowAnnotationComponent = observer(
  function ArrowAnnotationComponent({ arrow, canEdit, deleteArrow, getBoundingBox, readOnly }: IArrowAnnotationProps) {
    const [firstClick, setFirstClick] = useState(false);
    const [editingText, setEditingText] = useState(false);
    const [tempText, setTempText] = useState(arrow.text ?? "");
    const inputRef = useRef<HTMLInputElement|null>(null);
    useEffect(() => {
      // Focus on the text input when we start editing
      if (editingText && !readOnly) {
        inputRef.current?.focus();
      }
    }, [editingText, readOnly]);
    useEffect(() => {
      // When a new arrow is created, start editing its text
      if (arrow.isNew) {
        setEditingText(true);
      }
    }, [arrow]);

    // State used for dragging to move source, target, and text
    const [clientX, setClientX] = useState<number|undefined>();
    const [clientY, setClientY] = useState<number|undefined>();
    const [dragType, setDragType] = useState<DragType|undefined>();
    const [dragX, setDragX] = useState<number|undefined>();
    const [dragY, setDragY] = useState<number|undefined>();
    const [hoveringSource, setHoveringSource] = useState(false);
    const [hoveringTarget, setHoveringTarget] = useState(false);
    const dragDx = clientX !== undefined && dragX !== undefined ? clientX - dragX : 0;
    const dragDy = clientY !== undefined && dragY !== undefined ? clientY - dragY : 0;
    const dragging = clientX !== undefined && clientY !== undefined && dragX !== undefined && dragY !== undefined;
    const draggingSource = dragging && dragType === "source";
    const draggingTarget = dragging && dragType === "target";
    const draggingText = dragging && dragType === "text";
    const [sourceDragOffsetX, sourceDragOffsetY] = draggingSource ? [dragDx, dragDy] : [0, 0];
    const [targetDragOffsetX, targetDragOffsetY] = draggingTarget ? [dragDx, dragDy] : [0, 0];
    const [textDragOffsetX, textDragOffsetY] = draggingText ? [dragDx, dragDy] : [0, 0];

    // Bail if there is no source or target
    if (!arrow.sourceObject || !arrow.targetObject) return null;

    // Find bounding boxes for source and target objects
    const sourceBB = getBoundingBox(arrow.sourceObject);
    const targetBB = getBoundingBox(arrow.targetObject);
    if (!sourceBB || !targetBB) return null;

    function boundDelta(delta: number, boundingSize?: number) {
      if (boundingSize === undefined) return delta;
      const halfBoundingSize = boundingSize / 2;
      return Math.max(-halfBoundingSize, Math.min(halfBoundingSize, delta));
    }

    // Find positions for head and tail of arrow
    const [sDxOffset, sDyOffset] = arrow.sourceOffset ? [arrow.sourceOffset.dx, arrow.sourceOffset.dy] : [0, 0];
    const sourceX = sourceBB.left + sourceBB.width / 2 + boundDelta(sDxOffset + sourceDragOffsetX, sourceBB.width);
    const sourceY = sourceBB.top + sourceBB.height / 2 + boundDelta(sDyOffset + sourceDragOffsetY, sourceBB.height);
    const [tDxOffset, tDyOffset] = arrow.targetOffset ? [arrow.targetOffset.dx, arrow.targetOffset.dy] : [0, 0];
    const targetX = targetBB.left + targetBB.width / 2 + boundDelta(tDxOffset + targetDragOffsetX, targetBB.width);
    const targetY = targetBB.top + targetBB.height / 2 + boundDelta(tDyOffset + targetDragOffsetY, targetBB.height);

    // Set up text location and dimensions
    const textWidth = 150;
    const textHeight = 50;
    const [textDxOffset, textDyOffset] = arrow.textOffset ? [arrow.textOffset.dx, arrow.textOffset.dy] : [0, 0];
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const textCenterX = targetX - dx / 2 + textDxOffset + textDragOffsetX;
    const textCenterY = targetY - dy / 2 + textDyOffset + textDragOffsetY;
    const textX = textCenterX - textWidth / 2;
    const textY = textCenterY - textHeight / 2;

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

    const deleteHeight = 24;
    const deleteWidth = 24;
    const curveData = getCurve(sourceX, sourceY, textCenterX, textCenterY, targetX, targetY);
    const deleteX = curveData.deleteX - deleteWidth / 2;
    const deleteY = curveData.deleteY - deleteHeight / 2;
    function handleDelete(e: React.MouseEvent<SVGElement, MouseEvent>) {
      deleteArrow(arrow.id);
    }

    // Set up drag handles
    function handleMouseDown(e: React.MouseEvent<SVGElement|HTMLButtonElement, MouseEvent>, _dragType: DragType) {
      if (!canEdit) return;

      setDragX(e.clientX);
      setDragY(e.clientY);
      setDragType(_dragType);

      function handleMouseMove(e2: MouseEvent) {
        setClientX(e2.clientX);
        setClientY(e2.clientY);
      }
      function handleMouseUp(e2: MouseEvent) {
        const [startingOffset, setFunc, widthBound, heightBound] =
          _dragType === "source" ? [arrow.sourceOffset, arrow.setSourceOffset, sourceBB?.width, sourceBB?.height]
          : _dragType === "target" ? [arrow.targetOffset, arrow.setTargetOffset, targetBB?.width, targetBB?.height]
          : [arrow.textOffset, arrow.setTextOffset];
        const [startingDx, startingDy] = startingOffset ? [startingOffset.dx, startingOffset.dy] : [0, 0];
        const dDx = e2.clientX - e.clientX;
        const dDy = e2.clientY - e.clientY;
        setFunc(boundDelta(startingDx + dDx, widthBound), boundDelta(startingDy + dDy, heightBound));
  
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

    interface IDragHandleProps {
      draggingHandle?: boolean;
      dragTarget: "source" | "target";
      hovering?: boolean;
      setHovering: React.Dispatch<React.SetStateAction<boolean>>;
      startX: number;
      startY: number;
    }
    function DragHandle({ draggingHandle, dragTarget, hovering, setHovering, startX, startY }: IDragHandleProps) {
      return (
        <g
          className={classNames("drag-handle", { dragging: draggingHandle })}
          onMouseDown={e => handleMouseDown(e, dragTarget)}
          onMouseEnter={e => setHovering(true)}
          onMouseLeave={e => setHovering(false)}
        >
          <rect
            fill="transparent"
            height={kAnnotationNodeHeight}
            width={kAnnotationNodeWidth}
            x={startX - kAnnotationNodeWidth / 2}
            y={startY - kAnnotationNodeHeight / 2}
          />
          <AnnotationNode
            active={draggingHandle}
            cx={startX}
            cy={startY}
            hovering={hovering}
          />
        </g>
      );
    }

    const displayText = arrow.text?.trim();
    const hasText = !!displayText;
    const textButtonClasses = classNames("text-box", "text-display", {
      "can-edit": canEdit, "default-text": !hasText, "dragging": draggingText
    });
    return (
      <g>
        <CurvedArrow
          peakX={textCenterX} peakY={textCenterY}
          sourceX={sourceX} sourceY={sourceY}
          targetX={targetX} targetY={targetY}
        />
        <g transform={`translate(${deleteX} ${deleteY})`}>
          <DeleteButton onClick={handleDelete} />
        </g>
        <foreignObject
          className="text-object"
          height={`${textHeight}`}
          width={`${textWidth}`}
          x={`${textX}`}
          y={`${textY}`}
        >
          <div className="text-region">
            { editingText && !readOnly
              ? (
                <input
                  className="text-box text-input"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  ref={inputRef}
                  type="text"
                  value={tempText}
                />
              ) : (
                <button
                  className={textButtonClasses}
                  onClick={handleTextClick}
                  onMouseDown={e => handleMouseDown(e, "text")}
                >
                  {displayText || "Add text"}
                </button>
              )
            }
          </div>
        </foreignObject>
        <DragHandle
          draggingHandle={draggingSource}
          dragTarget="source"
          hovering={hoveringSource}
          setHovering={setHoveringSource}
          startX={sourceX}
          startY={sourceY}
        />
        <DragHandle
          draggingHandle={draggingTarget}
          dragTarget="target"
          hovering={hoveringTarget}
          setHovering={setHoveringTarget}
          startX={targetX}
          startY={targetY}
        />
      </g>
    );
  }
);
