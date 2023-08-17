import classNames from "classnames";
import React, { useMemo } from "react";

import { getCurve } from "./annotation-utilities";

import "./curved-arrow.scss";

const color = "#1500ff";
interface ICurvedArrowProps {
  className?: string;
  peakX: number;
  peakY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}
export function CurvedArrow({ className, peakX, peakY, sourceX, sourceY, targetX, targetY }: ICurvedArrowProps) {

  const { path, arrowheadAngle } = useMemo(() => {
    return getCurve(sourceX, sourceY, peakX, peakY, targetX, targetY);
  }, [peakX, peakY, sourceX, sourceY, targetX, targetY]);

  return (
    <g className={classNames("curved-arrow", className)}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={3}
      />
      <g transform={`translate(${targetX} ${targetY}) rotate(${arrowheadAngle})`}>
        <polygon points="0 -3 7 12 -7 12 0 -3" fill={color} />
      </g>
    </g>
  );
}
