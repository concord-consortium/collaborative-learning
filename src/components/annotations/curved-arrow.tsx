import classNames from "classnames";
import React, { useMemo, MouseEvent } from "react";

import { ArrowShape } from "../../models/annotations/arrow-annotation";
import { getSparrowCurve } from "./annotation-utilities";

import "./curved-arrow.scss";

interface ICurvedArrowProps {
  className?: string;
  shape: ArrowShape;
  hideArrowhead?: boolean;
  peakX: number;
  peakY: number;
  setHovering?: (hovering: boolean) => void;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  onClick?: (event: MouseEvent) => void;
}
export function CurvedArrow({
  className, shape, hideArrowhead, peakX, peakY, setHovering, sourceX, sourceY, targetX, targetY, onClick
}: ICurvedArrowProps) {

  const { path, arrowheadAngle } = useMemo(() => {
    return getSparrowCurve(sourceX, sourceY, peakX, peakY, targetX, targetY);
  }, [peakX, peakY, sourceX, sourceY, targetX, targetY]);

  return (
    <g className={classNames("curved-arrow", className)}>
      <path
        className="curved-arrow-stem"
        d={path}
        fill="none"
        strokeDasharray={shape === ArrowShape.curved ? "none" : "5,5"}
        onMouseEnter={e => setHovering?.(true)}
        onMouseLeave={e => setHovering?.(false)}
        onClick={onClick}
      />
      { !hideArrowhead && (
        <g transform={`translate(${targetX} ${targetY}) rotate(${arrowheadAngle})`}>
          <polygon className="curved-arrow-arrowhead" points="0 -5 10 13 -10 13 0 -5" />
        </g>
      )}
    </g>
  );
}
