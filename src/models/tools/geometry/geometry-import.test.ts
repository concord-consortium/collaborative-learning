import { safeJsonParse } from "../../../utilities/js-utils";
import { exportGeometryJson } from "./geometry-export";
import { preprocessImportFormat } from "./geometry-import";

const getImageMock = jest.fn();
jest.mock("../../image-map", () => ({
  gImageMap: {
    getImage: (...args: any[]) => getImageMock(...args)
  }
}));

// mock uniqueId so we can recognize auto-generated IDs
let idCount = 0;
jest.mock("../../../utilities/js-utils", () => {
  const { uniqueId, ...others } = jest.requireActual("../../../utilities/js-utils");
  return {
    uniqueId: () => `testid-${++idCount}`,
    ...others
  };
});

// verify that import => export => import => export results in two identical exports
const testRoundTrip = (input: any) => {
  const import1Result = preprocessImportFormat(input);
  const export1Json = exportGeometryJson(import1Result.changes);
  const export1Js = safeJsonParse(export1Json);
  const import2Result = preprocessImportFormat(export1Js);
  const export2Json = exportGeometryJson(import2Result.changes);
  const export2Js = safeJsonParse(export2Json);
  return [export1Js, export2Js];
};

describe("Geometry import", () => {

  beforeEach(() => {
    idCount = 0;
  });

  it("ignores non-importable content", () => {
    expect(preprocessImportFormat(null)).toBeNull();
    expect(preprocessImportFormat([])).toEqual([]);
    expect(preprocessImportFormat({})).toEqual({});
    expect(preprocessImportFormat({ foo: "bar" })).toEqual({ foo: "bar" });
    expect(preprocessImportFormat({ type: "Geometry", changes: [] })).toEqual({ type: "Geometry", changes: [] });
  });

  it("imports titles", () => {
    const input = {
      type: "Geometry",
      title: "MyTitle",
      board: {},
      objects: []
    };
    const result = preprocessImportFormat(input);

    expect(result.changes.length).toBe(2);
    expect(JSON.parse(result.changes[0]))
      .toEqual({ operation: "update", target: "metadata", properties: { title: input.title }});

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports boards with single range value", () => {
    const input = {
      type: "Geometry",
      board: {
        properties: {
          axisNames: ["xName", "yName"],
          axisLabels: ["xLabel", "yLabel"],
          axisMin: [0, 0],
          axisRange: [10]
        }
      },
      objects: []
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(1);
    const change = JSON.parse(result.changes[0]);
    const props = change.properties;

    expect(result.changes.length).toBe(1);
    expect(props.xName).toBe("xName");
    expect(props.yName).toBe("yName");
    expect(props.xAnnotation).toBe("xLabel");
    expect(props.yAnnotation).toBe("yLabel");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports boards with range value pair", () => {
    const input = {
      type: "Geometry",
      board: {
        properties: {
          axisNames: ["xName", "yName"],
          axisLabels: ["xLabel", "yLabel"],
          axisMin: [0, 0],
          axisRange: [10, 10]
        }
      },
      objects: []
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(1);
    const change = JSON.parse(result.changes[0]);
    const props = change.properties;

    expect(result.changes.length).toBe(1);
    expect(props.xName).toBe("xName");
    expect(props.yName).toBe("yName");
    expect(props.xAnnotation).toBe("xLabel");
    expect(props.yAnnotation).toBe("yLabel");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports points", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "point", parents: [0, 0] },
        { type: "point", parents: [2, 2], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { foo: "bar" }}
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(4);
    expect(JSON.parse(result.changes[2]).properties.id).toBe("p1");
    expect(JSON.parse(result.changes[3]).properties.foo).toBe("bar");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports points with comments", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "point", parents: [0, 0], comment: { text: "Point Comment"} }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(3);
    expect(JSON.parse(result.changes[2]).properties.text).toBe("Point Comment");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports polygons", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "polygon",
          parents: [
            { type: "point", parents: [0, 0] },
            { type: "point", parents: [5, 0] },
            { type: "point", parents: [5, 5] }
          ]
        },
        { type: "polygon",
          parents: [
            { type: "point", parents: [10, 10] },
            { type: "point", parents: [15, 10] },
            { type: "point", parents: [15, 15] }
          ],
          properties: {
            id: "poly1"
          }
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(9);
    expect(JSON.parse(result.changes[1]).parents).toEqual([0, 0]);
    expect(JSON.parse(result.changes[2]).parents).toEqual([5, 0]);
    expect(JSON.parse(result.changes[3]).parents).toEqual([5, 5]);
    expect(JSON.parse(result.changes[4]).target).toBe("polygon");
    expect(JSON.parse(result.changes[8]).target).toBe("polygon");
    expect(JSON.parse(result.changes[8]).properties.id).toBe("poly1");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports polygons with angle labels", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "polygon",
          parents: [
            { type: "point", parents: [0, 0], angleLabel: true },
            { type: "point", parents: [5, 0], angleLabel: true },
            { type: "point", parents: [5, 5], angleLabel: true }
          ]
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(8);
    expect(JSON.parse(result.changes[5]).target).toBe("vertexAngle");
    expect(JSON.parse(result.changes[6]).target).toBe("vertexAngle");
    expect(JSON.parse(result.changes[7]).target).toBe("vertexAngle");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports polygons with comments", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "polygon",
          parents: [
            { type: "point", parents: [0, 0] },
            { type: "point", parents: [5, 0] },
            { type: "point", parents: [5, 5] }
          ],
          comment: { text: "Polygon Comment" }
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(6);
    expect(JSON.parse(result.changes[1]).parents).toEqual([0, 0]);
    expect(JSON.parse(result.changes[2]).parents).toEqual([5, 0]);
    expect(JSON.parse(result.changes[3]).parents).toEqual([5, 5]);
    expect(JSON.parse(result.changes[5]).properties.text).toBe("Polygon Comment");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports images", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "image",
          parents: {
            url: "image/url",
            coords: [0, 0],
            size: [100, 100]
          }
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(2);
    expect(JSON.parse(result.changes[1]).parents[0]).toBe("image/url");
    expect(JSON.parse(result.changes[1]).parents[1]).toEqual([0, 0]);

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports images with comments", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "image",
          parents: {
            url: "image/url",
            coords: [0, 0],
            size: [100, 100]
          },
          comment: { text: "Image Comment" }
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(3);
    expect(JSON.parse(result.changes[1]).parents[0]).toBe("image/url");
    expect(JSON.parse(result.changes[1]).parents[1]).toEqual([0, 0]);
    expect(JSON.parse(result.changes[2]).properties.text).toBe("Image Comment");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports movable lines", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "movableLine",
          parents: [
            { type: "point", parents: [0, 0] },
            { type: "point", parents: [5, 5] }
          ]
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(2);
    expect(JSON.parse(result.changes[1]).target).toBe("movableLine");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports movable lines with comments", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "movableLine",
          parents: [
            { type: "point", parents: [0, 0] },
            { type: "point", parents: [5, 5] }
          ],
          comment: { text: "Line Comment" }
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(3);
    expect(JSON.parse(result.changes[1]).target).toBe("movableLine");
    expect(JSON.parse(result.changes[2]).target).toBe("comment");
    expect(JSON.parse(result.changes[2]).properties.text).toBe("Line Comment");

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });
});
