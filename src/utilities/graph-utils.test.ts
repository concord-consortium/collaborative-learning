import { goodTickValue } from "./graph-utils";

describe("goodTickValue", () => {

  it("goodTickValue() works as expected", () => {
    expect(goodTickValue(0)).toEqual([1, 4]);
    expect(goodTickValue(1)[0]).toBeCloseTo(0.2);
    expect(goodTickValue(5)).toEqual([1, 4]);
    expect(goodTickValue(8)).toEqual([1, 4]);
    expect(goodTickValue(10)).toEqual([1, 4]);
    expect(goodTickValue(12)).toEqual([2, 1]);
    expect(goodTickValue(15)).toEqual([2, 1]);
    expect(goodTickValue(20)).toEqual([2, 1]);
    expect(goodTickValue(25)).toEqual([2, 1]);
    expect(goodTickValue(30)).toEqual([5, 4]);
    expect(goodTickValue(200)).toEqual([20, 1]);
    expect(goodTickValue(250)).toEqual([20, 1]);
    expect(goodTickValue(251)).toEqual([50, 4]);
    expect(goodTickValue(300)).toEqual([50, 4]);
  });
});
