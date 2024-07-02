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
 * Finds the least-used number within a specified range in an iterable of numbers.
 *
 * @param {number} limit - The upper limit (exclusive) for the range of numbers to consider.
 * @param {Iterable<number>} iterable - An iterable of numbers to analyze.
 * @returns {number} The least-used number within the specified range, or 0 if the iterable is empty
 *    or all numbers are out of the specified range.
 */
export function findLeastUsedNumber(limit: number, iterable: Iterable<number>): number {
  const counts = new Array(limit).fill(0); // Array to count occurrences of numbers

  // Count occurrences of each valid integer in the iterable
  for (const number of iterable) {
    if (Number.isInteger(number) && number >= 0 && number < limit) {
      counts[number]++;
    }
  }

  let leastUsedNumber = 0;
  let leastCount = Infinity;

  // Find the least-used number between 0 and (limit - 1)
  for (let i = 0; i < limit; i++) {
    if (counts[i] < leastCount) {
      leastCount = counts[i];
      leastUsedNumber = i;
    }
  }

  return leastUsedNumber;
}
