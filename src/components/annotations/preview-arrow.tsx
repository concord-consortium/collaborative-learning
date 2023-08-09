import React from "react";

import { CurvedArrow } from "./curved-arrow";

interface IPreviewArrowProps {
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
}
export function PreviewArrow({ sourceX, sourceY, targetX, targetY }: IPreviewArrowProps) {
  if (sourceX !== undefined && sourceY !== undefined && targetX !== undefined && targetY !== undefined) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const mx = sourceX + dx / 2;
    const my = sourceY + dy / 2;
    const radius = Math.sqrt((dx / 2)**2 + (dy / 2)**2);
    const arrowAngle = Math.atan2(-dy, dx);

    const perpAngle = -Math.PI / 2 - arrowAngle;
    const px = mx + Math.cos(perpAngle) * radius;
    const py = my + Math.sin(perpAngle) * radius;

    return (
      <CurvedArrow
        peakX={px}
        peakY={py}
        sourceX={sourceX}
        sourceY={sourceY}
        targetX={targetX}
        targetY={targetY}
      />
    );
  }
  return null;
}
