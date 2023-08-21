import React from "react";

import { AnnotationNode } from "./annotation-node";
import { getDefaultPeak } from "./annotation-utilities";
import { CurvedArrow } from "./curved-arrow";

interface IPreviewArrowProps {
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
}
export function PreviewArrow({ sourceX, sourceY, targetX, targetY }: IPreviewArrowProps) {
  if (sourceX !== undefined && sourceY !== undefined && targetX !== undefined && targetY !== undefined) {
    const { peakX, peakY } = getDefaultPeak(sourceX, sourceY, targetX, targetY);

    return (
      <>
        <CurvedArrow
          className="preview-arrow"
          peakX={peakX}
          peakY={peakY}
          sourceX={sourceX}
          sourceY={sourceY}
          targetX={targetX}
          targetY={targetY}
        />
        <AnnotationNode
          active={true}
          cx={sourceX}
          cy={sourceY}
        />
      </>
    );
  }
  return null;
}
