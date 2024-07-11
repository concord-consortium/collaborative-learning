import { findLeastUsedNumber } from "./math-utils";

describe("findLeastUsedNumber", () => {

  it('should return the (first) least-used number within the range', () => {
    const numbers = [0, 0, 1, 2, 2, 3, 3, 3, 4, 5, 6, 7, 8, 9, 9];
    const limit = 10;
    expect(findLeastUsedNumber(limit, numbers)).toBe(1);
  });

  it('should return 0 for an empty iterable', () => {
    const numbers: number[] = [];
    const limit = 10;
    expect(findLeastUsedNumber(limit, numbers)).toBe(0);
  });

  it('should return 0 if all numbers are out of the specified range', () => {
    const numbers = [10, 11, 12, 13];
    const limit = 10;
    expect(findLeastUsedNumber(limit, numbers)).toBe(0);
  });

  it('should ignore invalid items', () => {
    const numbers = [-1, 1.5, 2/7, Math.PI, NaN, Infinity,
    0, 0, 0, 1, 1, 2, 2, 3, 4];
    const limit = 3;
    expect(findLeastUsedNumber(limit, numbers)).toBe(1);
  });

  it('should handle large inputs efficiently', () => {
    const numbers = Array.from({ length: 100000 }, (_, i) => i % 10);
    const limit = 10;
    expect(findLeastUsedNumber(limit, numbers)).toBe(0);
  });
});
