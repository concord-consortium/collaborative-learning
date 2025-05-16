import { resetMockUniqueId } from "../../document/document-content-tests/dc-test-utils";
import { getSnapshot } from "mobx-state-tree";
import { omitUndefined } from "../../../utilities/test-utils";
import { preprocessImportFormat } from "./geometry-import";
import { BoardModel } from "./geometry-model";
import { kDefaultBoardModelInputProps, kDefaultBoardModelOutputProps, kGeometryTileType } from "./geometry-types";

const getImageMock = jest.fn();
jest.mock("../../image-map", () => ({
  gImageMap: {
    getImage: (...args: any[]) => getImageMock(...args)
  }
}));

const kDefaultTestGeometryModel = {
  type: kGeometryTileType,
  board: getSnapshot(BoardModel.create(kDefaultBoardModelInputProps)),
  objects: {}
};

const testImport = (input: any) => {
  return omitUndefined(preprocessImportFormat(input));
};

// TODO: decide if there's a version of this round-trip test that makes sense any more
// verify that import => export => import => export results in two identical exports
const testRoundTrip = (input: any) => {
  return [{}, {}];
  // const import1Result = preprocessImportFormat(input);
  // const export1Json = exportGeometryJson(import1Result.changes);
  // const export1Js = safeJsonParse(export1Json);
  // const import2Result = preprocessImportFormat(export1Js);
  // const export2Json = exportGeometryJson(import2Result.changes);
  // const export2Js = safeJsonParse(export2Json);
  // return [export1Js, export2Js];
};

describe("Geometry import", () => {

  beforeEach(() => {
    resetMockUniqueId();
  });

  it("ignores non-importable content", () => {
    expect(testImport(null)).toBeNull();
    expect(testImport([])).toEqual([]);
    expect(testImport({})).toEqual({});
    expect(testImport({ foo: "bar" })).toEqual({ foo: "bar" });
    expect(testImport({ type: "Geometry", objects: 0 })).toEqual({ type: "Geometry", objects: 0 });
    expect(testImport({ type: "Geometry", changes: [] })).toEqual({ type: "Geometry", objects: {} });
  });

  it("imports titles", () => {
    const input = {
      type: "Geometry",
      title: "MyTitle",
      board: {},
      objects: []
    };
    expect(testImport(input)).toEqual({ ...kDefaultTestGeometryModel, extras: { title: "MyTitle" } });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports boards with single (y) range value", () => {
    const input = {
      type: "Geometry",
      board: {
        properties: {
          axisNames: ["xName", "yName"],
          axisLabels: ["xLabel", "yLabel"],
          axisMin: [0, 0],
          axisRange: [16]
        }
      },
      objects: []
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: {
        xAxis: { name: "xName", label: "xLabel", min: 0, range: 24, unit: 20 },
        yAxis: { name: "yName", label: "yLabel", min: 0, range: 16, unit: 20 }
      },
      objects: {}
    });

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
          axisRange: [24, 32]
        }
      },
      objects: []
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: {
        xAxis: { name: "xName", label: "xLabel", min: 0, range: 24, unit: 20 },
        yAxis: { name: "yName", label: "yLabel", min: 0, range: 32, unit: 10 }
      },
      objects: {}
    });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports points", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "point", parents: [0, 0] },
        { type: "point", parents: [2, 2], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { foo: "bar", name: "Bob", labelOption: "label" }}
      ]
    };
    jestSpyConsole("warn", spy => {
      expect(testImport(input)).toEqual({
        type: kGeometryTileType,
        board: kDefaultBoardModelOutputProps,
        objects: {
          "testid-1": { type: "point", id: "testid-1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
          "p1": { type: "point", id: "p1", colorScheme: 0, x: 2, y: 2, labelOption: "none" },
          "testid-2": { type: "point", id: "testid-2", colorScheme: 0, x: 5, y: 5, name: "Bob", labelOption: "label" }
        }
      });
      // warns about unrecognized property "foo"
      expect(spy).toHaveBeenCalledTimes(1);
    });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports points with comments at default location", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "point", parents: [0, 0], comment: { text: "Point Comment" } }
      ]
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      objects: {
        "testid-1": { type: "point", id: "testid-1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        "testid-2": { type: "comment", id: "testid-2", anchors: ["testid-1"], text: "Point Comment" }
      }
    });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports points with comments at authored location", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "point", parents: [0, 0], comment: { text: "Point Comment", parents: [5, 5] } }
      ]
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      objects: {
        "testid-1": { type: "point", id: "testid-1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        "testid-2": { type: "comment", id: "testid-2", anchors: ["testid-1"], x: 5, y: 5, text: "Point Comment" }
      }
    });

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
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      objects: {
        "testid-1": { type: "polygon", id: "testid-1", colorScheme: 0, labelOption: "none",
          points: ["testid-2", "testid-3", "testid-4"] },
        "testid-2": { type: "point", id: "testid-2", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        "testid-3": { type: "point", id: "testid-3", colorScheme: 0, x: 5, y: 0, labelOption: "none" },
        "testid-4": { type: "point", id: "testid-4", colorScheme: 0, x: 5, y: 5, labelOption: "none" },
        "testid-5": { type: "point", id: "testid-5", colorScheme: 0, x: 10, y: 10, labelOption: "none" },
        "testid-6": { type: "point", id: "testid-6", colorScheme: 0, x: 15, y: 10, labelOption: "none" },
        "testid-7": { type: "point", id: "testid-7", colorScheme: 0, x: 15, y: 15, labelOption: "none" },
        "poly1": { type: "polygon", id: "poly1", colorScheme: 0, labelOption: "none",
          points: ["testid-5", "testid-6", "testid-7"] },
      }
    });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports polygons with angle labels (nested)", () => {
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
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      objects: {
        "testid-1": { type: "polygon", id: "testid-1", colorScheme: 0, labelOption: "none",
          points: ["testid-2", "testid-3", "testid-4"] },
        "testid-2": { type: "point", id: "testid-2", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        "testid-3": { type: "point", id: "testid-3", colorScheme: 0, x: 5, y: 0, labelOption: "none" },
        "testid-4": { type: "point", id: "testid-4", colorScheme: 0, x: 5, y: 5, labelOption: "none" },
        "testid-5": { type: "vertexAngle", id: "testid-5", points: ["testid-4", "testid-2", "testid-3"] },
        "testid-6": { type: "vertexAngle", id: "testid-6", points: ["testid-2", "testid-3", "testid-4"] },
        "testid-7": { type: "vertexAngle", id: "testid-7", points: ["testid-3", "testid-4", "testid-2"] }
      }
    });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports polygons with angle labels (flat)", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "v1" } },
        { type: "point", parents: [5, 0], properties: { id: "v2" } },
        { type: "point", parents: [5, 5], properties: { id: "v3" } },
        { type: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p1" } },
        { type: "vertexAngle", parents: ["v3", "v1", "v2"], properties: { id: "a1" } },
        { type: "vertexAngle", parents: ["v1", "v2", "v3"], properties: { id: "a2" } },
        { type: "vertexAngle", parents: ["v2", "v3", "v1"], properties: { id: "a3" } }
      ]
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      objects: {
        "v1": { type: "point", id: "v1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        "v2": { type: "point", id: "v2", colorScheme: 0, x: 5, y: 0, labelOption: "none" },
        "v3": { type: "point", id: "v3", colorScheme: 0, x: 5, y: 5, labelOption: "none" },
        "p1": { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3"] },
        "a1": { type: "vertexAngle", id: "a1", points: ["v3", "v1", "v2"] },
        "a2": { type: "vertexAngle", id: "a2", points: ["v1", "v2", "v3"] },
        "a3": { type: "vertexAngle", id: "a3", points: ["v2", "v3", "v1"] }
      }
    });

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
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      objects: {
        "testid-1": { type: "polygon", id: "testid-1", colorScheme: 0, labelOption: "none",
          points: ["testid-2", "testid-3", "testid-4"] },
        "testid-2": { type: "point", id: "testid-2", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        "testid-3": { type: "point", id: "testid-3", colorScheme: 0, x: 5, y: 0, labelOption: "none" },
        "testid-4": { type: "point", id: "testid-4", colorScheme: 0, x: 5, y: 5, labelOption: "none" },
        "testid-5": { type: "comment", id: "testid-5", anchors: ["testid-1"], text: "Polygon Comment" }
      }
    });

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
            size: [183, 183]
          }
        }
      ]
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      bgImage: { type: "image", id: "testid-1", x: 0, y: 0, url: "image/url", width: 10, height: 10 },
      objects: {}
    });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports images with comments (nested)", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "image",
          parents: { url: "image/url", coords: [0, 0], size: [183, 183] },
          comment: { text: "Image Comment" } }
      ]
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      bgImage: { type: "image", id: "testid-1", x: 0, y: 0, url: "image/url", width: 10, height: 10 },
      objects: {
        "testid-2": { type: "comment", id: "testid-2", anchors: ["testid-1"], text: "Image Comment" }
      }
    });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });

  it("imports images with comments (flat)", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "image",
          parents: { url: "image/url", coords: [0, 0], size: [183, 183] },
          properties: { id: "i1" } },
        { type: "comment", properties: { id: "c1", anchor: "i1", text: "Image Comment" } }
      ]
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      bgImage: { type: "image", id: "i1", x: 0, y: 0, url: "image/url", width: 10, height: 10 },
      objects: {
        "c1": { type: "comment", id: "c1", anchors: ["i1"], text: "Image Comment" }
      }
    });

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
        },
        { type: "movableLine",
          parents: [
            { type: "point", parents: [10, 10] },
            { type: "point", parents: [15, 15] }
          ],
          properties: { id: "l1" }
        }
      ]
    };
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      objects: {
        "testid-1": { type: "movableLine", id: "testid-1", colorScheme: 0,
                      p1: { type: "point", id: "testid-1-point1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
                      p2: { type: "point", id: "testid-1-point2", colorScheme: 0, x: 5, y: 5, labelOption: "none" } },
        "l1": { type: "movableLine", id: "l1", colorScheme: 0,
                p1: { type: "point", id: "l1-point1", colorScheme: 0, x: 10, y: 10, labelOption: "none" },
                p2: { type: "point", id: "l1-point2", colorScheme: 0, x: 15, y: 15, labelOption: "none" } }
      }
    });

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
    expect(testImport(input)).toEqual({
      type: kGeometryTileType,
      board: kDefaultBoardModelOutputProps,
      objects: {
        "testid-1": { type: "movableLine", id: "testid-1", colorScheme: 0,
                      p1: { type: "point", id: "testid-1-point1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
                      p2: { type: "point", id: "testid-1-point2", colorScheme: 0, x: 5, y: 5, labelOption: "none" } },
        "testid-2": { type: "comment", id: "testid-2", anchors: ["testid-1"], text: "Line Comment" }
      }
    });

    const [expected, received] = testRoundTrip(input);
    expect(received).toEqual(expected);
  });
});
