import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { AnnotationNode } from "./annotation-node";
import { getSparrowCurve, kAnnotationNodeHeight, kAnnotationNodeWidth } from "./annotation-utilities";
import { CurvedArrow } from "./curved-arrow";
import { boundDelta } from "../../models/annotations/annotation-utils";
import {
  IArrowAnnotation, kArrowAnnotationTextHeight, kArrowAnnotationTextWidth
} from "../../models/annotations/arrow-annotation";
import { IClueObject } from "../../models/annotations/clue-object";

import SparrowDeleteButton from "../../assets/icons/annotations/sparrow-delete-button.svg";

import "./arrow-annotation.scss";

type DragType = "source" | "target" | "text";
const maxCharacters = 30;

interface IDragHandleProps {
  draggingHandle?: boolean;
  dragTarget: "source" | "target";
  handleMouseDown: (e: React.MouseEvent<SVGElement | HTMLButtonElement, MouseEvent>, _dragType: DragType) => void;
  startX: number;
  startY: number;
}
function DragHandle({
  draggingHandle, dragTarget, handleMouseDown, startX, startY
}: IDragHandleProps) {
  return (
    <g
      className={classNames("drag-handle", { dragging: draggingHandle })}
      onMouseDown={e => handleMouseDown(e, dragTarget)}
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
      />
    </g>
  );
}

interface IArrowAnnotationProps {
  arrow: IArrowAnnotation;
  canEdit?: boolean;
  deleteArrow: (arrowId: string) => void;
  documentBottom: number;
  documentLeft: number;
  documentRight: number;
  documentTop: number;
  getBoundingBox: (object: IClueObject) =>
    { height: number, left: number, top: number, width: number } | null | undefined;
  key?: string;
  readOnly?: boolean;
}
export const ArrowAnnotationComponent = observer(
  function ArrowAnnotationComponent({
    arrow, canEdit, deleteArrow, documentBottom, documentLeft, documentRight, documentTop, getBoundingBox, readOnly
  }: IArrowAnnotationProps) {
    const [firstClick, setFirstClick] = useState(false);
    const [editingText, setEditingText] = useState(false);
    const [tempText, setTempText] = useState(arrow.text ?? "");
    const [hoveringStem, setHoveringStem] = useState(false);
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
    const dragDx = clientX !== undefined && dragX !== undefined ? clientX - dragX : 0;
    const dragDy = clientY !== undefined && dragY !== undefined ? clientY - dragY : 0;
    const dragging = clientX !== undefined && clientY !== undefined && dragX !== undefined && dragY !== undefined;
    const draggingSource = dragging && dragType === "source";
    const draggingTarget = dragging && dragType === "target";
    const draggingText = dragging && dragType === "text";
    const [sourceDragOffsetX, sourceDragOffsetY] = draggingSource ? [dragDx, dragDy] : [0, 0];
    const [targetDragOffsetX, targetDragOffsetY] = draggingTarget ? [dragDx, dragDy] : [0, 0];
    const [textDragOffsetX, textDragOffsetY] = draggingText ? [dragDx, dragDy] : [0, 0];

    // Find bounding boxes for source and target objects
    const sourceBB = arrow.sourceObject ? getBoundingBox(arrow.sourceObject) : undefined;
    const targetBB = arrow.targetObject ? getBoundingBox(arrow.targetObject) : undefined;

    // The the arrow's points curve data, given current drag and the source and target bounding boxes
    const dragOffsets = {
      sourceDragOffsetX, sourceDragOffsetY, targetDragOffsetX, targetDragOffsetY, textDragOffsetX, textDragOffsetY
    };
    const {
      sourceX, sourceY, targetX, targetY, textX, textY, textCenterX, textCenterY,
      textMinXOffset, textMaxXOffset, textMinYOffset, textMaxYOffset
    } = arrow.getPoints(documentLeft, documentRight, documentTop, documentBottom, dragOffsets, sourceBB, targetBB);
    const missingData = sourceX === undefined || sourceY === undefined || textCenterX === undefined
      || textCenterY === undefined || targetX === undefined || targetY === undefined;
    const curveData = useMemo(() => {
      if (missingData) return undefined;
      return getSparrowCurve(sourceX, sourceY, textCenterX, textCenterY, targetX, targetY, true);
    }, [missingData, sourceX, sourceY, textCenterX, textCenterY, targetX, targetY]);

    // Bail if we're missing anything necessary
    if (!sourceBB || !targetBB || !curveData || missingData) return null;

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
      setTempText(e.target.value.slice(0, maxCharacters));
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
    const deleteX = (curveData.deleteX ?? 0) - deleteWidth / 2;
    const deleteY = (curveData.deleteY ?? 0) - deleteHeight / 2;
    function handleDelete(e: React.MouseEvent<SVGElement, MouseEvent>) {
      if (!readOnly) {
        deleteArrow(arrow.id);
      }
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
        if (_dragType === "text") {
          // Bound the text offset to the document
          const dx = Math.max(textMinXOffset ?? 0, Math.min(textMaxXOffset ?? 0, startingDx + dDx));
          const dy = Math.max(textMinYOffset ?? 0, Math.min(textMaxYOffset ?? 0, startingDy + dDy));
          setFunc(dx, dy);
        } else {
          setFunc(boundDelta(startingDx + dDx, widthBound), boundDelta(startingDy + dDy, heightBound));
        }
  
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

    const displayText = arrow.text?.trim();
    const hasText = !!displayText;
    const textButtonClasses = classNames("text-box", "text-display", {
      "can-edit": canEdit, "default-text": !hasText, "dragging": draggingText
    });
    return (
      <g>
        <g className="actual-sparrow">
          <CurvedArrow
            className="background-arrow"
            hideArrowhead={true}
            peakX={textCenterX} peakY={textCenterY}
            setHovering={setHoveringStem}
            sourceX={sourceX} sourceY={sourceY}
            targetX={targetX} targetY={targetY}
          />
          <CurvedArrow
            className="foreground-arrow"
            peakX={textCenterX} peakY={textCenterY}
            sourceX={sourceX} sourceY={sourceY}
            targetX={targetX} targetY={targetY}
          />
          <g transform={`translate(${deleteX} ${deleteY})`}>
            <SparrowDeleteButton
              className={classNames({ "visible-delete-button": hoveringStem })}
              onClick={handleDelete}
            />
          </g>
        </g>
        <foreignObject
          className="text-object"
          height={`${kArrowAnnotationTextHeight}`}
          width={`${kArrowAnnotationTextWidth}`}
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
                  style={{ width: `calc(${tempText.length}ch + 2ch)` }}
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
          handleMouseDown={handleMouseDown}
          startX={sourceX}
          startY={sourceY}
        />
        <DragHandle
          draggingHandle={draggingTarget}
          dragTarget="target"
          handleMouseDown={handleMouseDown}
          startX={targetX}
          startY={targetY}
        />
      </g>
    );
  }
);
