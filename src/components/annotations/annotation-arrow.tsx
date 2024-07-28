import classNames from "classnames";
import React, { useMemo, MouseEvent } from "react";

import { ArrowShape } from "../../models/annotations/arrow-annotation";
import { getSparrowCurve, getSparrowStraight } from "./annotation-utilities";

import "./annotation-arrow.scss";

interface IAnnotationArrowProps {
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
export function AnnotationArrow({
  className, shape, hideArrowhead, peakX, peakY, setHovering, sourceX, sourceY, targetX, targetY, onClick
}: IAnnotationArrowProps) {

  const { path, arrowheadAngle } = useMemo(() => {
    if (shape === ArrowShape.straight) {
      return getSparrowStraight(sourceX, sourceY, peakX, peakY, targetX, targetY);
    } else {
      return getSparrowCurve(sourceX, sourceY, peakX, peakY, targetX, targetY);
    }
  }, [shape, peakX, peakY, sourceX, sourceY, targetX, targetY]);

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
