import classNames from "classnames";
import React, { useMemo } from "react";

import { halfPi, twoPi, normalizeAngle } from "./annotation-utilities";

import "./curved-arrow.scss";

const color = "#1500ff";
const controlStrength = .5;
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
    // Determine deltas and angle between source and target
    const arrowDx = targetX - sourceX;
    const arrowDy = targetY - sourceY;
    const arrowAngle = normalizeAngle(Math.atan2(-arrowDy, arrowDx));
  
    // Determine deltas, angle, and length between source and peak
    const firstDx = peakX - sourceX;
    const firstDy = peakY - sourceY;
    const firstAngle = normalizeAngle(Math.atan2(-firstDy, firstDx));
    const firstLength = Math.sqrt(firstDx**2 + firstDy**2);
  
    // Determine length and deltas from source to intersect of straight arrow
    // and perpendicular line that goes through peak
    const firstAngleDifference = normalizeAngle(firstAngle - arrowAngle);
    const firstAngleOpposite = normalizeAngle(halfPi - firstAngleDifference);
    const firstIntersectLength = firstLength * Math.sin(firstAngleOpposite);
    const firstIntersectDx = firstIntersectLength * Math.cos(arrowAngle);
    const firstIntersectDy = firstIntersectLength * -Math.sin(arrowAngle);
  
    // Determine anchors for first curve.
    // These go from source along line perpendicular to arrow, and from peak along line parallel to arrow.
    // If the angle between the arrow angle and peak angle is between half pi and 3 halves pi
    //   (the peak is behind the end point), we need to bend the curve the opposite way
    const firstBeyond = firstAngleDifference > halfPi && firstAngleDifference < 3 * halfPi;
    const firstBeyondFactor = firstBeyond ? -1 : 1;
    const firstControlX = peakX - firstIntersectDx * firstBeyondFactor;
    const firstControlY = peakY - firstIntersectDy * firstBeyondFactor;
    const firstControlX1 = sourceX + (firstControlX - sourceX) * controlStrength;
    const firstControlY1 = sourceY + (firstControlY - sourceY) * controlStrength;
    const firstControlX2 = peakX - firstIntersectDx * controlStrength * firstBeyondFactor;
    const firstControlY2 = peakY - firstIntersectDy * controlStrength * firstBeyondFactor;
    const firstControl1 = `${firstControlX1} ${firstControlY1}`;
    const firstControl2 = `${firstControlX2} ${firstControlY2}`;
  
    // Determine deltas, angle, and length between target and peak
    const secondDx = peakX - targetX;
    const secondDy = peakY - targetY;
    const secondAngle = normalizeAngle(Math.atan2(-secondDy, secondDx));
    const secondLength = Math.sqrt(secondDx**2 + secondDy**2);
  
    // Determine length and deltas from target to intersect of straight arrow
    // and perpendicular line that goes through peak (same point as above)
    const secondAngleDifference = normalizeAngle(secondAngle - arrowAngle);
    const secondAngleOpposite = normalizeAngle(halfPi - secondAngleDifference);
    const secondIntersectLength = secondLength * Math.sin(secondAngleOpposite);
    const secondIntersectDx = secondIntersectLength * Math.cos(arrowAngle);
    const secondIntersectDy = secondIntersectLength * -Math.sin(arrowAngle);
  
    // Determine anchors for second curve.
    // These go from peak along line parallal to arrow, and from target along line perpendicular to arrow.
    const secondBeyond = secondAngleDifference < halfPi || secondAngleDifference > 3 * halfPi;
    const secondBeyondFactor = secondBeyond ? -1 : 1;
    const secondControlX = peakX - secondIntersectDx * secondBeyondFactor;
    const secondControlY = peakY - secondIntersectDy * secondBeyondFactor;
    const secondControlX1 = peakX - secondIntersectDx * controlStrength * secondBeyondFactor;
    const secondControlY1 = peakY - secondIntersectDy * controlStrength * secondBeyondFactor;
    const secondControlX2 = targetX - (targetX - secondControlX) * controlStrength;
    const secondControlY2 = targetY - (targetY - secondControlY) * controlStrength;
    const secondControl1 = `${secondControlX1} ${secondControlY1}`;
    const secondControl2 = `${secondControlX2} ${secondControlY2}`;
  
    // Construct path
    const pathStart = `M ${sourceX} ${sourceY}`;
    const pathPeak = `C ${firstControl1} ${firstControl2} ${peakX} ${peakY}`;
    const pathEnd = `C ${secondControl1} ${secondControl2} ${targetX} ${targetY}`;
    const _path = `${pathStart} ${pathPeak} ${pathEnd}`;
  
    // Determine angle of arrowhead
    const findArrowheadAngle = () => {
      if (secondBeyond) {
        const secondBeyondAngle = normalizeAngle(Math.atan2(secondControlY - targetY, secondControlX - targetX));
        return normalizeAngle(secondBeyondAngle - halfPi) * 180 / Math.PI;
      } else {
        const targetToPeakAngle = normalizeAngle(Math.atan2(secondDy, -secondDx));
        const adjustedTargetToPeakAngle = normalizeAngle(halfPi - targetToPeakAngle);
        const peakAboveArrow = normalizeAngle(targetToPeakAngle - arrowAngle) > Math.PI;
        const controlAngle = normalizeAngle(
          (peakAboveArrow ? 3 * halfPi : halfPi) - normalizeAngle(arrowAngle + halfPi));
        // If adjustedTargetToPeakAngle and controlAngle are more than pi apart, the arrowhead math breaks down
        const adjustedControlAngle = Math.abs(adjustedTargetToPeakAngle - controlAngle) < Math.PI
          ? controlAngle : adjustedTargetToPeakAngle < controlAngle ? controlAngle - twoPi : controlAngle + twoPi;
        const secondAnglePercentage = normalizeAngle(Math.abs(secondAngleDifference - Math.PI)) / halfPi;
        const percentageExponent = firstBeyond ? 8 : 4;
        const adjustedSecondAnglePercentage = 1 - (1 - secondAnglePercentage) ** percentageExponent;
        return normalizeAngle(adjustedControlAngle * adjustedSecondAnglePercentage
          + adjustedTargetToPeakAngle * (1 - adjustedSecondAnglePercentage)) * 180 / Math.PI;
      }
    };
    const _arrowheadAngle = findArrowheadAngle();

    return {
      path: _path,
      arrowheadAngle: _arrowheadAngle
    };
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
