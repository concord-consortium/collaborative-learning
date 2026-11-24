import { describeNumberlineObject } from "./handle-numberline-tile";

function describe_(objectId: string, points: any) {
  return describeNumberlineObject({
    tile: { id: "n1", content: { type: "Numberline", points } },
    objectId,
    objectType: "point",
    dataSets: [],
    variables: []
  });
}

describe("describeNumberlineObject", () => {
  it("names a point by the value it sits at", () => {
    expect(describe_("p1", { p1: { id: "p1", xValue: 1.5 } })).toBe("the point at 1.5");
  });

  // An open point means "up to but not including", which is the whole of what a student is saying
  // when they draw one.
  it("says when a point is open", () => {
    expect(describe_("p1", { p1: { id: "p1", xValue: 2, isOpen: true } })).toBe("the open point at 2");
  });

  it("reports nothing for a point the tile no longer holds", () => {
    expect(describe_("gone", { p1: { id: "p1", xValue: 1 } })).toBeUndefined();
  });
});
