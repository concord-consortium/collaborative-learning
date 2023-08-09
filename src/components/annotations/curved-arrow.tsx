import React from "react";

import "./curved-arrow.scss";

interface ICurvedArrowProps {
  peakX?: number;
  peakY?: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}
export function CurvedArrow({ peakX, peakY, sourceX, sourceY, targetX, targetY }: ICurvedArrowProps) {
  const color = "blue";

  if (peakX === undefined || peakY === undefined) {
    // Determine angle of arrowhead
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const angle = 90-Math.atan2(-dy, dx)*180/Math.PI;

    return (
      <g className="curved-arrow">
        <path d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`} stroke={color} strokeWidth={3} />
        <g transform={`translate(${targetX} ${targetY}) rotate(${angle})`}>
          <polygon points="0 -3 7 12 -7 12 0 -3" fill={color} />
        </g>
      </g>
    );
  } else {
    const dx = targetX - peakX;
    const dy = targetY - peakY;
    const angle = 90 - Math.atan2(-dy, dx) * 180 / Math.PI;

    return (
      <g className="curved-arrow">
        <path
          d={`M ${sourceX} ${sourceY} L ${peakX} ${peakY} L ${targetX} ${targetY}`}
          fill="none"
          stroke={color}
          strokeWidth={3}
        />
        <g transform={`translate(${targetX} ${targetY}) rotate(${angle})`}>
          <polygon points="0 -3 7 12 -7 12 0 -3" fill={color} />
        </g>
      </g>
    );
  }
}
