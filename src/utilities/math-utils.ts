export const halfPi = Math.PI / 2;
export const twoPi = Math.PI * 2;
export function normalizeAngle(angle: number) {
  let _angle = angle;
  while (_angle < 0) { _angle += twoPi; }
  while (_angle > twoPi) { _angle -= twoPi; }
  return _angle;
}

export type Point = [x: number, y: number];

export function isFiniteNumber(x: any): x is number {
  return x != null && Number.isFinite(x);
}

/**
 * Rounds a number in an intuitive way.
 * The digits parameter is used as a number of significant digits to maintain for small numbers.
 * However, rounding never carries beyond the integer part of a number, even if it contains more than
 * that number of significant digits.
 * @param x number to round
 * @param digits number of digits of precision to maintain in decimals
 * @returns a rounded number
 */
export function roundForDisplay(x: number, digits: number): number {
  const intRange = Math.pow(10, digits);
  if (x<-intRange || x>intRange) {
    return Math.round(x);
  }
  return +x.toPrecision(digits);
}
