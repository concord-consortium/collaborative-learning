import { halfPi, twoPi, normalizeAngle } from "../../utilities/math-utils";

export const kAnnotationNodeHeight = 24;
export const kAnnotationNodeWidth = 24;

// Returns the default peak for a sparrow from sourceX, sourceY to targetX, targetY.
const shortArcPeakScale = 1;
const longArcPeakScale = .5;
const shortArcLength = 100;
const longArcLength = 300;
export function getDefaultPeak(sourceX: number, sourceY: number, targetX: number, targetY: number) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const mx = sourceX + dx / 2;
  const my = sourceY + dy / 2;
  const arcLength = Math.sqrt((dx / 2)**2 + (dy / 2)**2);
  const arrowAngle = normalizeAngle(Math.atan2(-dy, dx));

  const multiplier = arrowAngle > halfPi && arrowAngle < 3 * halfPi ? 1 : -1;
  const perpendicularAngle = normalizeAngle(multiplier * Math.PI / 2 - arrowAngle);
  const peakPercent = arcLength <= shortArcLength ? shortArcPeakScale
    : arcLength >= longArcLength ? longArcPeakScale
    : (arcLength - shortArcLength) / (longArcLength - shortArcLength)
      * (longArcPeakScale - shortArcPeakScale) + shortArcPeakScale;
  const peakDx = Math.cos(perpendicularAngle) * arcLength * peakPercent;
  const peakDy = Math.sin(perpendicularAngle) * arcLength * peakPercent;
  const peakX = mx + peakDx;
  const peakY = my + peakDy;
  return {
    peakDx, peakDy,
    peakX, peakY
  };
}

interface CurveData {
  arrowheadAngle: number;
  deleteX?: number;
  deleteY?: number;
  path: string;
}
const controlStrength = .5;
export function getSparrowCurve(
  sourceX: number, sourceY: number,
  peakX: number, peakY: number,
  targetX: number, targetY: number,
  includeDelete?: boolean
): CurveData {
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

  // Determine control points for first curve.
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

  // Determine control points for second curve.
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

  // Determine position of the delete button
  // There's no clean way to determine the length mid point of a benzier curve, so this approximates it.
  // First, it measures the lengths of segments with end points along the curve.
  // It then figures out which segment contains half the length of the curve.
  // It then determines a t value that represents the approximate position of the midpoint.
  // Finally, it returns the point along the curve at that t value.
  const findDeletePosition = () => {
    // Only find the delete position if it's requested, since it's a complex computation.
    if (!includeDelete) return { deleteX: undefined, deleteY: undefined };

    const segments = 10;
    const deletePercentage = .5; // The percentage of the total distance of the curve where the delete button should go.
    const pointBetween = (start: number, end: number, t: number) => start + (end - start) * t;
    const tPoint = (t: number) => {
      const firstMidX1 = pointBetween(peakX, secondControlX1, t);
      const firstMidY1 = pointBetween(peakY, secondControlY1, t);
      const firstMidX2 = pointBetween(secondControlX1, secondControlX2, t);
      const firstMidY2 = pointBetween(secondControlY1, secondControlY2, t);
      const firstMidX3 = pointBetween(secondControlX2, targetX, t);
      const firstMidY3 = pointBetween(secondControlY2, targetY, t);
      const secondMidX1 = pointBetween(firstMidX1, firstMidX2, t);
      const secondMidY1 = pointBetween(firstMidY1, firstMidY2, t);
      const secondMidX2 = pointBetween(firstMidX2, firstMidX3, t);
      const secondMidY2 = pointBetween(firstMidY2, firstMidY3, t);
      const tX = pointBetween(secondMidX1, secondMidX2, t);
      const tY = pointBetween(secondMidY1, secondMidY2, t);
      return { tX, tY };
    };

    // Break the curve into segments, measuring the length of each segment
    interface SegmentData {
      length: number; // The length of the segment
      lengthPercent: number; // The percentage of the total length of the curve goes through the segment
      runningLength: number; // The length of all segments through this one
      tX: number; // The x coordinate of the end point of the segment
      tY: number; // The y coordinate of the end point of the segment
    }
    const tData: SegmentData[] = [{ tX: peakX, tY: peakY, length: 0, lengthPercent: 0, runningLength: 0 }];
    for (let i = 1; i <= segments; i++) {
      const { tX, tY } = tPoint(i / segments);
      const prevData = tData[i - 1];
      const length = Math.sqrt((tX - prevData.tX) ** 2 + (tY - prevData.tY) ** 2);
      const runningLength = prevData.runningLength + length;
      tData[i] = { tX, tY, length, lengthPercent: NaN, runningLength };
    }

    // Determine which segment contains the approximate desired percentage for the delete button
    const totalLength = tData[tData.length - 1].runningLength;
    for (let i = 0; i < tData.length; i++) {
      const curData = tData[i];
      curData.lengthPercent = curData.runningLength / totalLength;
      if (curData.lengthPercent >= deletePercentage) {
        const prevData = tData[i - 1];
        const percentDiff = deletePercentage - prevData.lengthPercent;
        const tOffset = percentDiff / (curData.lengthPercent - prevData.lengthPercent);
        const deleteT = (i - 1 + tOffset) / segments;
        const dPosition = tPoint(deleteT);
        return { deleteX: dPosition.tX, deleteY: dPosition.tY };
      }
    }

    // We should never reach this, but just in case use the t instead of length percentage
    const deleteData = tPoint(deletePercentage);
    return { deleteX: deleteData.tX, deleteY: deleteData.tY };
  };
  const deletePosition = findDeletePosition();

  // Cache and return the data for the curve
  const curveData = {
    deleteX: deletePosition.deleteX,
    deleteY: deletePosition.deleteY,
    path: _path,
    arrowheadAngle: _arrowheadAngle
  };
  return curveData;
}
