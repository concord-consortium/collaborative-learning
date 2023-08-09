import React from "react";

import "./curved-arrow.scss";

interface ICurvedArrowProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}
export function CurvedArrow({ sourceX, sourceY, targetX, targetY }: ICurvedArrowProps) {
  // Determine angle of arrowhead
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = 90-Math.atan2(-dy, dx)*180/Math.PI;

  const color = "blue";
  return (
    <g className="curved-arrow">
      <path d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`} stroke={color} strokeWidth={3} />
      <g transform={`translate(${targetX} ${targetY}) rotate(${angle})`}>
        <polygon points="0 -3 7 12 -7 12 0 -3" fill={color} />
      </g>
    </g>
  );
}
