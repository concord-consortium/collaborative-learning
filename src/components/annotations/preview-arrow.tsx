import React from "react";

import { getDeafultPeak } from "./annotation-utilities";
import { CurvedArrow } from "./curved-arrow";

interface IPreviewArrowProps {
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
}
export function PreviewArrow({ sourceX, sourceY, targetX, targetY }: IPreviewArrowProps) {
  if (sourceX !== undefined && sourceY !== undefined && targetX !== undefined && targetY !== undefined) {
    const { peakX, peakY } = getDeafultPeak(sourceX, sourceY, targetX, targetY);

    return (
      <CurvedArrow
        peakX={peakX}
        peakY={peakY}
        sourceX={sourceX}
        sourceY={sourceY}
        targetX={targetX}
        targetY={targetY}
      />
    );
  }
  return null;
}
