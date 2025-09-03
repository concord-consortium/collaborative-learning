import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { AnnotationNode } from "./annotation-node";
import { getSparrowCurve, getSparrowStraight, kAnnotationNodeDefaultRadius } from "./annotation-utilities";
import { AnnotationArrow } from "./annotation-arrow";
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
  centerRadius?: number;
  draggingHandle?: boolean;
  dragTarget: "source" | "target";
  handleMouseDown: (e: React.MouseEvent<SVGElement | HTMLButtonElement, MouseEvent>, _dragType: DragType) => void;
  highlightRadius?: number;
  startX: number;
  startY: number;
}
function DragHandle({
  centerRadius, draggingHandle, dragTarget, handleMouseDown, highlightRadius, startX, startY
}: IDragHandleProps) {
  const halfHeight = highlightRadius ?? kAnnotationNodeDefaultRadius;
  return (
    <g
      className={classNames("drag-handle", { dragging: draggingHandle })}
      onMouseDown={e => handleMouseDown(e, dragTarget)}
    >
      <rect
        fill="transparent"
        height={2 * halfHeight}
        width={2 * halfHeight}
        x={startX - halfHeight}
        y={startY - halfHeight}
      />
      <AnnotationNode
        active={draggingHandle}
        centerRadius={centerRadius}
        cx={startX}
        cy={startY}
        highlightRadius={highlightRadius}
      />
    </g>
  );
}

function determineDragOffsets(dragType: DragType|undefined,
    clientX: number|undefined, clientY: number|undefined, dragX: number|undefined, dragY: number|undefined) {
  const dragDx = clientX !== undefined && dragX !== undefined ? clientX - dragX : 0;
  const dragDy = clientY !== undefined && dragY !== undefined ? clientY - dragY : 0;
  const isDragging = clientX !== undefined && clientY !== undefined && dragX !== undefined && dragY !== undefined;
  const [sourceDragOffsetX, sourceDragOffsetY] = isDragging && dragType === "source" ? [dragDx, dragDy] : [0, 0];
  const [targetDragOffsetX, targetDragOffsetY] = isDragging && dragType === "target" ? [dragDx, dragDy] : [0, 0];
  const [textDragOffsetX, textDragOffsetY] = isDragging && dragType === "text" ? [dragDx, dragDy] : [0, 0];
  return {
    sourceDragOffsetX, sourceDragOffsetY, targetDragOffsetX, targetDragOffsetY, textDragOffsetX, textDragOffsetY
  };
}

interface IArrowAnnotationProps {
  arrow: IArrowAnnotation;
  canEdit?: boolean;
  deleteArrow: (arrowId: string) => void;
  handleArrowClick: (arrowId: string, event: React.MouseEvent) => void;
  handleDragHandleNonDrag:
    (e: MouseEvent, tileId?: string, objectId?: string, objectType?: string) => void;
  documentBottom: number;
  documentLeft: number;
  documentRight: number;
  documentTop: number;
  getBoundingBox: (object: IClueObject) =>
    { height: number, left: number, top: number, width: number} | null | undefined;
  getObjectNodeRadii: (object?: IClueObject) => { centerRadius?: number, highlightRadius?: number} | undefined;
  key?: string;
  readOnly?: boolean;
  sourceViewTransform?: { offsetX: number; offsetY: number; scale: number };
  targetViewTransform?: { offsetX: number; offsetY: number; scale: number };
}
export const ArrowAnnotationComponent = observer(
  function ArrowAnnotationComponent({
    arrow, canEdit, deleteArrow, handleArrowClick, handleDragHandleNonDrag,
    documentBottom, documentLeft, documentRight, documentTop, getBoundingBox,
    getObjectNodeRadii, readOnly, sourceViewTransform, targetViewTransform
  }: IArrowAnnotationProps) {

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
    const mouseDownTime = useRef<number|undefined>();
    const dragging = clientX !== undefined && clientY !== undefined && dragX !== undefined && dragY !== undefined;
    const draggingSource = dragging && dragType === "source";
    const draggingTarget = dragging && dragType === "target";
    const draggingText = dragging && dragType === "text";

    // Find bounding boxes for source and target objects
    const sourceBB = arrow.sourceObject ? getBoundingBox(arrow.sourceObject) : undefined;
    const targetBB = arrow.targetObject ? getBoundingBox(arrow.targetObject) : undefined;

    // Find the arrow's points curve data, given current drag and the source and target bounding boxes
    const dragOffsets = determineDragOffsets(dragType, clientX, clientY, dragX, dragY);
    const {
      sourceX, sourceY, targetX, targetY, textX, textY, textCenterX, textCenterY,
      textMinXOffset, textMaxXOffset, textMinYOffset, textMaxYOffset
    } = arrow.getPoints(
      documentLeft, documentRight, documentTop, documentBottom, dragOffsets,
      sourceBB, sourceViewTransform, targetBB, targetViewTransform
    );
    const missingData = sourceX === undefined || sourceY === undefined || textCenterX === undefined
      || textCenterY === undefined || targetX === undefined || targetY === undefined;
    const curveData = useMemo(() => {
      if (missingData) return undefined;
      if (arrow.shape === "straight") {
        return getSparrowStraight(sourceX, sourceY, textCenterX, textCenterY, targetX, targetY, true);
      } else {
        return getSparrowCurve(sourceX, sourceY, textCenterX, textCenterY, targetX, targetY, true);
      }
    }, [missingData, arrow.shape, sourceX, sourceY, targetX, targetY, textCenterX, textCenterY]);

    // Bail if we're missing anything necessary
    if (!curveData || missingData) return null;

    // Set up text handlers
    function handleTextClick(e: React.MouseEvent) {
      if (!canEdit) return;

      if (e.detail === 2) {
        setEditingText(true);
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
      setTempText(e.target.value.slice(0,maxCharacters));
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

    // Set up drag handles.
    // A quick click that doesn't move on a drag handle doesn't drag it; it creates a new Sparrow.
    // So, mouse down tracks the time and location.
    function handleMouseDown(e: React.MouseEvent<SVGElement|HTMLButtonElement, MouseEvent>, _dragType: DragType) {
      if (!canEdit) return;

      setDragX(e.clientX);
      setDragY(e.clientY);
      setDragType(_dragType);
      mouseDownTime.current = performance.now();

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
          if (mouseDownTime.current
            && performance.now() - mouseDownTime.current < 500
            && Math.abs(dDx) < 4
            && Math.abs(dDy) < 4) {
            // If the mouse didn't move much and the duration was short, treat it as a click
            const attachedObject = _dragType === "source" ? arrow.sourceObject : arrow.targetObject;
            if (attachedObject) {
              handleDragHandleNonDrag(e2, attachedObject.tileId, attachedObject.objectId, attachedObject.objectType);
            } else {
              handleDragHandleNonDrag(e2); // free end of arrow has no object.
            }
          } else {
            // For source and target changes, also update the text offset propoprtionally
            const currentDragOffsets = determineDragOffsets(_dragType, e2.clientX, e2.clientY, e.clientX, e.clientY);
            const { textCenterX: tcX, textCenterY: tcY, textOriginX: toX, textOriginY: toY }
              = arrow.getPoints(documentLeft, documentRight, documentTop, documentBottom,
                  currentDragOffsets, sourceBB, sourceViewTransform, targetBB, targetViewTransform);
            if (tcX !== undefined && tcY !== undefined) {
              arrow.setTextOffset(tcX - toX, tcY - toY);
            }
            // And then update the source or target
            setFunc(boundDelta(startingDx + dDx, widthBound), boundDelta(startingDy + dDy, heightBound));
          }
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

    const sourceNodeRadii = getObjectNodeRadii(arrow.sourceObject);
    const targetNodeRadii = getObjectNodeRadii(arrow.targetObject);

    const displayText = arrow.text?.trim();
    const hasText = !!displayText;
    const textButtonClasses = classNames("text-box", "text-display", {
      "can-edit": canEdit, "default-text": !hasText, "dragging": draggingText
    });
    return (
      <g>
        <g className={classNames("actual-sparrow", { selected: arrow.isSelected })}>
          <AnnotationArrow
            className="background-arrow"
            shape={arrow.shape}
            hideArrowhead={true}
            peakX={textCenterX} peakY={textCenterY}
            setHovering={setHoveringStem}
            sourceX={sourceX} sourceY={sourceY}
            targetX={targetX} targetY={targetY}
            onClick={(e) => handleArrowClick(arrow.id, e)}
          />
          <AnnotationArrow
            className="foreground-arrow"
            shape={arrow.shape}
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
                  style={{ width: `calc(${tempText.length}ch + 2ch)`}}
                  type="text"
                  value={tempText}
                />
              ) : (
                <button
                  className={textButtonClasses}
                  onClick={e => handleTextClick(e)}
                  onMouseDown={e => handleMouseDown(e, "text")}
                >
                  {displayText || "Add text"}
                </button>
              )
            }
          </div>
        </foreignObject>
        <DragHandle
          centerRadius={sourceNodeRadii?.centerRadius}
          draggingHandle={draggingSource}
          dragTarget="source"
          handleMouseDown={handleMouseDown}
          highlightRadius={sourceNodeRadii?.highlightRadius}
          startX={sourceX}
          startY={sourceY}
        />
        <DragHandle
          centerRadius={targetNodeRadii?.centerRadius}
          draggingHandle={draggingTarget}
          dragTarget="target"
          handleMouseDown={handleMouseDown}
          highlightRadius={targetNodeRadii?.highlightRadius}
          startX={targetX}
          startY={targetY}
        />
      </g>
    );
  }
);
