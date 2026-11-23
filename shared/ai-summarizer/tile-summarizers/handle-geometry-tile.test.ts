import { describeGeometryObject } from "./handle-geometry-tile";

const content = {
  type: "Geometry",
  objects: {
    p1: { id: "p1", type: "point", x: 1, y: 2 },
    p2: { id: "p2", type: "point", x: 3, y: 4, name: "B" },
    poly1: { id: "poly1", type: "polygon", points: ["p1", "p2"] },
    line1: { id: "line1", type: "line", point1: "p1", point2: "p2" }
  }
};

function describe_(objectId: string, objectType?: string) {
  return describeGeometryObject({
    tile: { id: "g1", content }, objectId, objectType, dataSets: [], variables: []
  });
}

describe("describeGeometryObject", () => {
  // The geometry tile has no summarizer of its own, so a label that said only "point n4Kx" would
  // name an id nothing else in the summary prints. The coordinates have to carry the phrase.
  it("names an unnamed point by its coordinates", () => {
    expect(describe_("p1", "point")).toBe("the point at (1, 2)");
  });

  it("uses the student's label for a named point", () => {
    expect(describe_("p2", "point")).toBe("point B at (3, 4)");
  });

  it("names a polygon by its vertex count", () => {
    expect(describe_("poly1", "polygon")).toBe("the polygon with 2 vertices");
  });

  // A segment is never stored as an object: it is derived from its polygon, and its id carries the
  // two point ids. Nothing but those points can name it.
  it("names a segment by the points it joins", () => {
    expect(describe_("p1::p2", "segment")).toBe("the segment from (1, 2) to (3, 4)");
  });

  it("reports nothing for a segment whose points are gone", () => {
    expect(describe_("p1::deleted", "segment")).toBeUndefined();
  });

  it("names a line by the points it runs through", () => {
    expect(describe_("line1", "line")).toBe("the line through (1, 2) and (3, 4)");
  });

  it("reports nothing for an object the tile no longer holds", () => {
    expect(describe_("gone", "point")).toBeUndefined();
  });

  // A linked point is plotted from a table case, so it is named the way the table names it.
  it("names a linked point by the row and column it comes from", () => {
    const result = describeGeometryObject({
      tile: { id: "g1", content },
      objectId: "c2:a1",
      objectType: "linkedPoint",
      dataSets: [{
        id: "ds1", providerId: "t1", tileIds: ["g1"], numCases: 2, data: [],
        caseIds: ["c1", "c2"],
        attributes: [{ id: "a1", name: "distance", values: ["10", "24.5"] }]
      }],
      variables: []
    });
    expect(result).toBe("the point from row 2 of distance (24.5)");
  });
});
