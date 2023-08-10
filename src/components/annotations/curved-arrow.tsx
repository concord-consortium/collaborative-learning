import React from "react";

import "./curved-arrow.scss";

const twoPi = Math.PI * 2;
const normalizeAngle = (angle: number) => {
  let _angle = angle;
  while (_angle < 0) { _angle += twoPi; }
  while (_angle > twoPi) { _angle -= twoPi; }
  return _angle;
};

interface ICurvedArrowProps {
  peakX: number;
  peakY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}
export function CurvedArrow({ peakX, peakY, sourceX, sourceY, targetX, targetY }: ICurvedArrowProps) {
  const color = "blue";
  const anchorStrength = .5;

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
  const firstAngleOpposite = normalizeAngle(Math.PI / 2 - firstAngleDifference);
  const firstIntersectLength = firstLength * Math.sin(firstAngleOpposite);
  const firstIntersectDx = firstIntersectLength * Math.cos(arrowAngle);
  const firstIntersectDy = firstIntersectLength * -Math.sin(arrowAngle);

  // Determine anchors for first curve.
  // These go from source along line perpendicular to arrow, and from peak along line parallel to arrow.
  const firstAnchorX = peakX - firstIntersectDx;
  const firstAnchorY = peakY - firstIntersectDy;
  const firstAnchorX1 = sourceX + (firstAnchorX - sourceX) * anchorStrength;
  const firstAnchorY1 = sourceY + (firstAnchorY - sourceY) * anchorStrength;
  const firstAnchorX2 = peakX - firstIntersectDx * anchorStrength;
  const firstAnchorY2 = peakY - firstIntersectDy * anchorStrength;
  const firstAnchor1 = `${firstAnchorX1} ${firstAnchorY1}`;
  const firstAnchor2 = `${firstAnchorX2} ${firstAnchorY2}`;

  // Determine deltas, angle, and length between target and peak
  const secondDx = peakX - targetX;
  const secondDy = peakY - targetY;
  const secondAngle = normalizeAngle(Math.atan2(-secondDy, secondDx));
  const secondLength = Math.sqrt(secondDx**2 + secondDy**2);

  // Determine length and deltas from target to intersect of straight arrow
  // and perpendicular line that goes through peak (same point as above)
  const secondAngleDifference = normalizeAngle(secondAngle - arrowAngle);
  const secondAngleOpposite = normalizeAngle(Math.PI / 2 - secondAngleDifference);
  const secondIntersectLength = secondLength * Math.sin(secondAngleOpposite);
  const secondIntersectDx = secondIntersectLength * Math.cos(arrowAngle);
  const secondIntersectDy = secondIntersectLength * -Math.sin(arrowAngle);

  // Determine anchors for second curve.
  // These go from peak along line parallal to arrow, and from target along line perpendicular to arrow.
  const secondAnchorX = peakX - secondIntersectDx;
  const secondAnchorY = peakY - secondIntersectDy;
  const secondAnchorX1 = peakX - secondIntersectDx * anchorStrength;
  const secondAnchorY1 = peakY - secondIntersectDy * anchorStrength;
  const secondAnchorX2 = targetX - (targetX - secondAnchorX) * anchorStrength;
  const secondAnchorY2 = targetY - (targetY - secondAnchorY) * anchorStrength;
  const secondAnchor1 = `${secondAnchorX1} ${secondAnchorY1}`;
  const secondAnchor2 = `${secondAnchorX2} ${secondAnchorY2}`;

  // Determine angle of arrowhead
  // const arrowheadAngle = normalizeAngle((Math.PI / 2 - secondAngleDifference) / 2 + Math.PI) * 180 / Math.PI;
  // console.log(`arrowheadAngle`, secondAngleDifference, arrowheadAngle);
  const dx = targetX - peakX;
  const dy = targetY - peakY;
  const arrowheadAngle = 90 - Math.atan2(-dy, dx) * 180 / Math.PI;

  const pathStart = `M ${sourceX} ${sourceY}`;
  const pathPeak = `C ${firstAnchor1} ${firstAnchor2} ${peakX} ${peakY}`;
  const pathEnd = `C ${secondAnchor1} ${secondAnchor2} ${targetX} ${targetY}`;
  return (
    <g className="curved-arrow">
      <path
        d={`${pathStart} ${pathPeak} ${pathEnd}`}
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
