import { getBoundingBoxIntersections } from "./jxg-movable-line";

describe("Movable line utils", () => {

  it("calculates boundary intersections on edges", () => {
    const mockBoard = {attr: {boundingbox: [-1, 5, 5, -1]}} as any as JXG.Board;
    const intersections = getBoundingBoxIntersections(0, 3, mockBoard);
    expect(intersections).toEqual([[-1, 3], [5, 3]]);
  });

  it("calculates boundary intersections on corners", () => {
    const mockBoard = {attr: {boundingbox: [-5, 5, 5, -5]}} as any as JXG.Board;
    const intersections = getBoundingBoxIntersections(1, 0, mockBoard);
    expect(intersections).toEqual([[-5, -5], [5, 5]]);
  });
});
