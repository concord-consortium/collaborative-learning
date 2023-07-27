import { observer } from "mobx-react";
import React from "react";

import { ArrowAnnotationType } from "../../models/annotations/arrow-annotation";
import { ClueObjectType } from "../../models/annotations/clue-object";

interface IArrowAnnotationProps {
  arrow: ArrowAnnotationType;
  getBoundingBox: (object: ClueObjectType) =>
    { height: number, left: number, top: number, width: number} | null | undefined;
  key?: string;
}
export const ArrowAnnotationComponent = observer(
  function ArrowAnnotationComponent({ arrow, getBoundingBox }: IArrowAnnotationProps) {
    if (!arrow.sourceObject || !arrow.targetObject) return null;

    const sourceBB = getBoundingBox(arrow.sourceObject);
    const targetBB = getBoundingBox(arrow.targetObject);
    if (!sourceBB || !targetBB) return null;

    const sourceX = sourceBB.left + sourceBB.width / 2;
    const sourceY = sourceBB.top + sourceBB.height / 2;
    const targetX = targetBB.left + targetBB.width / 2;
    const targetY = targetBB.top + targetBB.height / 2;
    
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const angle = 90-Math.atan2(-dy, dx)*180/Math.PI;

    const color = "blue";
    return (
      <>
        <path d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`} stroke={color} strokeWidth={3} />
        <g transform={`translate(${targetX} ${targetY}) rotate(${angle})`}>
          <polygon points="0 -3 7 12 -7 12 0 -3" fill={color} />
        </g>
      </>
    );
  }
);
