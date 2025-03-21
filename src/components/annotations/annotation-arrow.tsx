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
    <g className={classNames("arrow", className)}>
      <path
        className="arrow-stem"
        d={path}
        fill="none"
        onMouseEnter={e => setHovering?.(true)}
        onMouseLeave={e => setHovering?.(false)}
        onClick={onClick}
      />
      { !hideArrowhead && (
        <g transform={`translate(${targetX} ${targetY}) rotate(${arrowheadAngle})`}>
          <polygon className="arrow-arrowhead" points="0 -5 10 13 -10 13 0 -5" />
        </g>
      )}
    </g>
  );
}
