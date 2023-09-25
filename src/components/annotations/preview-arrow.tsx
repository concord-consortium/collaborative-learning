import React from "react";

import { AnnotationNode } from "./annotation-node";
import { getDefaultPeak } from "./annotation-utilities";
import { CurvedArrow } from "./curved-arrow";
import { kTextHorizontalMargin, kTextVerticalMargin } from "../../models/annotations/arrow-annotation";

interface IPreviewArrowProps {
  documentHeight: number;
  documentWidth: number;
  sourceCenterRadius?: number;
  sourceHighlightRadius?: number;
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
}
export function PreviewArrow({
  documentHeight, documentWidth, sourceCenterRadius, sourceHighlightRadius, sourceX, sourceY, targetX, targetY
}: IPreviewArrowProps) {
  if (sourceX !== undefined && sourceY !== undefined && targetX !== undefined && targetY !== undefined) {
    const { peakX, peakY } = getDefaultPeak(sourceX, sourceY, targetX, targetY);
    // Bound the peak to the document
    const _peakX = Math.max(kTextHorizontalMargin, Math.min(documentWidth - kTextHorizontalMargin, peakX));
    const _peakY = Math.max(kTextVerticalMargin, Math.min(documentHeight - kTextVerticalMargin, peakY));

    return (
      <>
        <CurvedArrow
          className="preview-arrow"
          peakX={_peakX}
          peakY={_peakY}
          sourceX={sourceX}
          sourceY={sourceY}
          targetX={targetX}
          targetY={targetY}
        />
        <AnnotationNode
          active={true}
          centerRadius={sourceCenterRadius}
          cx={sourceX}
          cy={sourceY}
          highlightRadius={sourceHighlightRadius}
        />
      </>
    );
  }
  return null;
}
