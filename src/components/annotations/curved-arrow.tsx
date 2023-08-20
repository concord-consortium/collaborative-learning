import classNames from "classnames";
import React, { useMemo } from "react";

import { getCurve } from "./annotation-utilities";

import "./curved-arrow.scss";

interface ICurvedArrowProps {
  className?: string;
  hideArrowhead?: boolean;
  peakX: number;
  peakY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}
export function CurvedArrow({
  className, hideArrowhead, peakX, peakY, sourceX, sourceY, targetX, targetY
}: ICurvedArrowProps) {

  const { path, arrowheadAngle } = useMemo(() => {
    return getCurve(sourceX, sourceY, peakX, peakY, targetX, targetY);
  }, [peakX, peakY, sourceX, sourceY, targetX, targetY]);

  return (
    <g className={classNames("curved-arrow", className)}>
      <path
        className="curved-arrow-stem"
        d={path}
        fill="none"
      />
      { !hideArrowhead && (
        <g transform={`translate(${targetX} ${targetY}) rotate(${arrowheadAngle})`}>
          <polygon className="curved-arrow-arrowhead" points="0 -4 8 13 -8 13 0 -4" />
        </g>
      )}
    </g>
  );
}
