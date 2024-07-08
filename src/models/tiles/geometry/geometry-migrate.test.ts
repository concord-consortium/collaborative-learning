import { safeJsonParse } from "../../../utilities/js-utils";
import { omitUndefined } from "../../../utilities/test-utils";
import { convertChangesToModel, exportGeometryJson } from "./geometry-migrate";
import { ELabelOption, JXGChange } from "./jxg-changes";


// default unitPx is 18.3, but for testing purposes we use rounder numbers
const kAltBoardUnitPx = 16;

const kLocalImageUrl = "assets/logo_tw.png";

const kDefaultBoardModelProps = { xAxis: { min: -2, range: 24, unit: 20 }, yAxis: { min: -1, range: 16, unit: 20 } };
const kUpdatedBoardModelProps = { xAxis: { min: -2, range: 30, unit: 16 }, yAxis: { min: -1, range: 20, unit: 16 } };
const kEmptyJsonProps = { type: "Geometry", objects: [] };
const kEmptyModelProps = { type: "Geometry", objects: {} };
const kDefaultModelProps = { type: "Geometry", board: kDefaultBoardModelProps, objects: {} };
const kUpdatedModelProps = { type: "Geometry", board: kUpdatedBoardModelProps, objects: {} };

const convertChangesToJson = (changes: JXGChange[]) => {
  const changesJson = changes.map(change => JSON.stringify(change));
  const exportJson = exportGeometryJson(changesJson);
  const exportJs = safeJsonParse(exportJson);
  // log the JSON on error for debugging
  // !exportJs && console.log("JSON PARSE ERROR\n----------------\n", exportJson);
  return exportJs;
};

const convertChangesToModelSnapshot = (changes: JXGChange[]) => {
  const model = convertChangesToModel(changes);
  // log the JSON on error for debugging
  // !exportJs && console.log("JSON PARSE ERROR\n----------------\n", exportJson);
  return omitUndefined(model);
};

// TODO: decide if there's a version of this round-trip test that makes sense any more
// verify that export => import => export results in two identical exports
export const testRoundTrip = (changes: JXGChange[]) => {
  // const exportJs = convertChangesToJson(changes);
  // const importResult = preprocessImportFormat(exportJs);
  // const importChanges = importResult.changes.map((change: string) => safeJsonParse(change));
  // return [convertChangesToJson(importChanges), exportJs];
  return [{}, {}];
};

describe("Geometry migration", () => {
  it("should handle invalid exports", () => {
    expect(convertChangesToJson([])).toEqual(kEmptyJsonProps);
    expect(convertChangesToJson([null as any])).toEqual(kEmptyJsonProps);

    expect(convertChangesToModelSnapshot([])).toEqual(kEmptyModelProps);
    expect(convertChangesToModelSnapshot([null as any])).toEqual(kEmptyModelProps);
  });

  it("should migrate board that has just been created", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: []
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual(kDefaultModelProps);
  });

  it("should migrate board with default units if necessary", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1] }
      }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: []
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual(kDefaultModelProps);
  });

  it("should migrate board that has also been updated", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      {
        operation: "update",
        target: "board",
        properties: {
          boardScale: {
            xMin: -2,
            yMin: -1,
            unitX: 16,
            unitY: 16,
            canvasWidth: 800,
            canvasHeight: 600,
            xName: "xName",
            yName: "yName",
            xAnnotation: "xLabel",
            yAnnotation: "yLabel"
          }
        }
      }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: {
        properties: {
          axisMin: [-2, -1],
          axisRange: [30, 20],
          axisNames: ["xName", "yName"],
          axisLabels: ["xLabel", "yLabel"]
        }
      },
      objects: []
    });

    expect(convertChangesToModelSnapshot(changes))
      .toEqual({ type: "Geometry",
        board: {
          xAxis: { name: "xName", label: "xLabel", min: -2, unit: kAltBoardUnitPx, range: 30 },
          yAxis: { name: "yName", label: "yLabel", min: -1, unit: kAltBoardUnitPx, range: 20 } },
        objects: {}
      });
  });

  it("should migrate board that has been partially updated", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      {
        operation: "update",
        target: "board",
        properties: {
          boardScale: {
            xMin: -2,
            yMin: -1,
            unitX: 16,
            unitY: 16,
            canvasWidth: 800,
            canvasHeight: 600
          }
        }
      }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: {
        properties: {
          axisMin: [-2, -1],
          axisRange: [30, 20]
        }
      },
      objects: []
    });

    expect(convertChangesToModelSnapshot(changes)).toEqual(kUpdatedModelProps);
  });

  it("should migrate title", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "update", target: "metadata", properties: { title: "My Geometry" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      title: "My Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: []
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({ ...kDefaultModelProps, extras: { title: "My Geometry" } });
  });

  it("should not export malformed title", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "update", target: "metadata" }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: []
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual(kDefaultModelProps);
  });

  it("should migrate created points", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p2: { type: "point", id: "p2", colorScheme: 0, x: 5, y: 5, labelOption: "none" }
      }
    });
  });

  it("should migrate multiple points created with a single change", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [[0, 0], [5, 5]], properties: [{ id: "p1" }, { id: "p2" }] }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p2: { type: "point", id: "p2", colorScheme: 0, x: 5, y: 5, labelOption: "none" }
      }
    });
  });

  it("should migrate updated points", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } },
      { operation: "update", target: "point", targetID: "p2", properties: { position: [2, 2] } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [2, 2], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p2: { type: "point", id: "p2", colorScheme: 0, x: 2, y: 2, labelOption: "none" }
      }
    });
  });

  it("should migrate updated points using normalized coordinates", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } },
      { operation: "update", target: "point", targetID: "p2", properties: { position: [1, 2, 2] } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [2, 2], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p2: { type: "point", id: "p2", colorScheme: 0, x: 2, y: 2, labelOption: "none" }
      }
    });
  });

  it("should migrate point with comment at default location", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } },
      { operation: "create", target: "comment", properties: { id: "c1", anchor: "p1" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { id: "p2" } },
        { type: "comment", properties: { id: "c1", anchor: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p2: { type: "point", id: "p2", colorScheme: 0, x: 5, y: 5, labelOption: "none" },
        c1: { type: "comment", id: "c1", anchors: ["p1"] }
      }
    });
  });

  it("should migrate point with comment at authored location", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } },
      { operation: "create", target: "comment", parents: [5, 5], properties: { id: "c1", anchor: "p1" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { id: "p2" } },
        { type: "comment", parents: [5, 5], properties: { id: "c1", anchor: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p2: { type: "point", id: "p2", colorScheme: 0, x: 5, y: 5, labelOption: "none" },
        c1: { type: "comment", id: "c1", anchors: ["p1"], x: 5, y: 5 }
      }
    });
  });

  it("should migrate points with comments at updated locations", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } },
      { operation: "create", target: "comment", parents: [5, 5], properties: { id: "c1", anchor: "p1" } },
      { operation: "update", target: "object", targetID: "c1", properties: { position: [2, 2] } },
      { operation: "create", target: "comment", properties: { id: "c2", anchor: "p2" } },
      { operation: "update", target: "object", targetID: "c2", properties: { position: [8, 8] } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { id: "p2" } },
        { type: "comment", parents: [2, 2], properties: { id: "c1", anchor: "p1" } },
        { type: "comment", parents: [3, 3], properties: { id: "c2", anchor: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p2: { type: "point", id: "p2", colorScheme: 0, x: 5, y: 5, labelOption: "none" },
        c1: { type: "comment", id: "c1", anchors: ["p1"], x: 2, y: 2 },
        c2: { type: "comment", id: "c2", anchors: ["p2"], x: 3, y: 3 }
      }
    });
  });

  it("should migrate points with additional properties", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1", colorScheme: 1 } },
      { operation: "create", target: "point", parents: [5, 5],
          properties: { id: "p2", name: "Bob", labelOption: ELabelOption.kLabel } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1", colorScheme: 1 } },
        { type: "point", parents: [5, 5], properties: { id: "p2", name: "Bob", labelOption: "label" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 1, x: 0, y: 0, labelOption: "none" },
        p2: { type: "point", id: "p2", colorScheme: 0, x: 5, y: 5, name: "Bob", labelOption: "label" }
      }
    });
  });

  it("should not export points without ids", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0] },
      { operation: "create", target: "point", parents: [5, 5] }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual(kDefaultModelProps);
  });

  it("should not export deleted points", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } },
      { operation: "delete", target: "point", targetID: "p2" }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "point", id: "p1", colorScheme: 0, x: 0, y: 0, labelOption: "none" }
      }
    });
  });

  it("should not export linked points", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "tableLink", properties: { ids: ["lp1", "lp2", "lp3"] } },
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual(kDefaultModelProps);
  });

  it("should migrate polygons of linked points", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "tableLink", properties: { ids: ["lp1", "lp2", "lp3"] }},
      { operation: "create", target: "polygon", parents: ["lp1", "lp2", "lp3"], properties: { id: "p1" } },
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "polygon", parents: ["lp1", "lp2", "lp3"], properties: { id: "p1" } },
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        p1: { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["lp1", "lp2", "lp3"]},
      }
    });
  });

  it("should establish links from legacy saves", () => {
    const linkChanges1: JXGChange[] = [
      { operation: "create", target: "board", properties:
        { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 } },
      { operation: "create", target: "tableLink", targetID: "table1",
        links: { tileIds: ["table1"] } }
    ];

    expect(convertChangesToJson(linkChanges1)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [],
      links: ["table1"]
    });

    const snapshot = convertChangesToModelSnapshot(linkChanges1);
    expect(snapshot).toEqual({
      ...kDefaultModelProps,
      links: ["table1"]
    });

    const linkChanges2: JXGChange[] = linkChanges1.concat([
      { operation: "create", target: "tableLink", targetID: "table2",
        links: { tileIds: ["table2"] } }
    ]);

    expect(convertChangesToJson(linkChanges2)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [],
      links: ["table1", "table2"]
    });

    expect(convertChangesToModelSnapshot(linkChanges2)).toEqual({
      ...kDefaultModelProps,
      links: ["table1", "table2"]
    });

    const linkChanges3: JXGChange[] = linkChanges2.concat([
      { operation: "delete", target: "tableLink", targetID: "table1",
        links: { tileIds: ["table1"] } }
    ]);

    expect(convertChangesToJson(linkChanges3)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [],
      links: ["table2"]
    });

    expect(convertChangesToModelSnapshot(linkChanges3)).toEqual({
      ...kDefaultModelProps,
      links: ["table2"]
    });
  });

  it("should migrate polygons", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "v1" } },
      { operation: "create", target: "point", parents: [5, 0], properties: { id: "v2" } },
      { operation: "create", target: "point", parents: [0, 5], properties: { id: "v3" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p1" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p2" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "v1" } },
        { type: "point", parents: [5, 0], properties: { id: "v2" } },
        { type: "point", parents: [0, 5], properties: { id: "v3" } },
        { type: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p1" } },
        { type: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        v1: { type: "point", id: "v1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        v2: { type: "point", id: "v2", colorScheme: 0, x: 5, y: 0, labelOption: "none" },
        v3: { type: "point", id: "v3", colorScheme: 0, x: 0, y: 5, labelOption: "none" },
        p1: { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3"]},
        p2: { type: "polygon", id: "p2", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3"]}
      }
    });
  });

  it("should not export deleted polygons", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "v1" } },
      { operation: "create", target: "point", parents: [5, 0], properties: { id: "v2" } },
      { operation: "create", target: "point", parents: [0, 5], properties: { id: "v3" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p1" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p2" } },
      { operation: "delete", target: "polygon", targetID: "p1" }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "v1" } },
        { type: "point", parents: [5, 0], properties: { id: "v2" } },
        { type: "point", parents: [0, 5], properties: { id: "v3" } },
        { type: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        v1: { type: "point", id: "v1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        v2: { type: "point", id: "v2", colorScheme: 0, x: 5, y: 0, labelOption: "none" },
        v3: { type: "point", id: "v3", colorScheme: 0, x: 0, y: 5, labelOption: "none" },
        p2: { type: "polygon", id: "p2", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3"]}
      }
    });
  });

  it("should migrate polygon with only undeleted points", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "v1" } },
      { operation: "create", target: "point", parents: [5, 0], properties: { id: "v2" } },
      { operation: "create", target: "point", parents: [0, 5], properties: { id: "v3" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "v4" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } },
      { operation: "delete", target: "point", targetID: "v4" }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "v1" } },
        { type: "point", parents: [5, 0], properties: { id: "v2" } },
        { type: "point", parents: [0, 5], properties: { id: "v3" } },
        { type: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        v1: { type: "point", id: "v1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        v2: { type: "point", id: "v2", colorScheme: 0, x: 5, y: 0, labelOption: "none" },
        v3: { type: "point", id: "v3", colorScheme: 0, x: 0, y: 5, labelOption: "none" },
        p1: { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3"]}
      }
    });
  });

  it("should migrate polygons with segment labels", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 6], properties: { id: "v1" } },
      { operation: "create", target: "point", parents: [6, 6], properties: { id: "v2" } },
      { operation: "create", target: "point", parents: [6, 0], properties: { id: "v3" } },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "v4" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } },
      { operation: "update", target: "polygon", targetID: "p1", parents: ["v1", "v2"],
        properties: { labelOption: ELabelOption.kLength } },
      { operation: "update", target: "polygon", targetID: "p1", parents: ["v2", "v3"],
        properties: { labelOption: ELabelOption.kLabel } }
    ];
    // NOTE: Legacy JSON export apparently never supported segment labels. ¯\_ (ツ)_/¯
    // We could fix this, but since we're deprecating the legacy import format, it doesn't seem worth it.
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 6], properties: { id: "v1" } },
        { type: "point", parents: [6, 6], properties: { id: "v2" } },
        { type: "point", parents: [6, 0], properties: { id: "v3" } },
        { type: "point", parents: [0, 0], properties: { id: "v4" } },
        { type: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        v1: { type: "point", id: "v1", colorScheme: 0, x: 0, y: 6, labelOption: "none" },
        v2: { type: "point", id: "v2", colorScheme: 0, x: 6, y: 6, labelOption: "none" },
        v3: { type: "point", id: "v3", colorScheme: 0, x: 6, y: 0, labelOption: "none" },
        v4: { type: "point", id: "v4", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p1: { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3", "v4"],
              labels: [{ id: "v1::v2", option: "length" }, { id: "v2::v3", option: "label" }] }
      }
    });
  });

  it("should migrate polygons with comments at default locations", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 6], properties: { id: "v1" } },
      { operation: "create", target: "point", parents: [6, 6], properties: { id: "v2" } },
      { operation: "create", target: "point", parents: [6, 0], properties: { id: "v3" } },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "v4" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } },
      { operation: "create", target: "comment", properties: { id: "c1", anchor: "p1" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 6], properties: { id: "v1" } },
        { type: "point", parents: [6, 6], properties: { id: "v2" } },
        { type: "point", parents: [6, 0], properties: { id: "v3" } },
        { type: "point", parents: [0, 0], properties: { id: "v4" } },
        { type: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } },
        { type: "comment", properties: { id: "c1", anchor: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        v1: { type: "point", id: "v1", colorScheme: 0, x: 0, y: 6, labelOption: "none" },
        v2: { type: "point", id: "v2", colorScheme: 0, x: 6, y: 6, labelOption: "none" },
        v3: { type: "point", id: "v3", colorScheme: 0, x: 6, y: 0, labelOption: "none" },
        v4: { type: "point", id: "v4", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p1: { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3", "v4"]},
        c1: { type: "comment", id: "c1", anchors: ["p1"] }
      }
    });
  });

  it("should migrate polygons with comments at authored locations", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 6], properties: { id: "v1" } },
      { operation: "create", target: "point", parents: [6, 6], properties: { id: "v2" } },
      { operation: "create", target: "point", parents: [6, 0], properties: { id: "v3" } },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "v4" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } },
      { operation: "create", target: "comment", parents: [3, 3], properties: { id: "c1", anchor: "p1" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 6], properties: { id: "v1" } },
        { type: "point", parents: [6, 6], properties: { id: "v2" } },
        { type: "point", parents: [6, 0], properties: { id: "v3" } },
        { type: "point", parents: [0, 0], properties: { id: "v4" } },
        { type: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } },
        { type: "comment", parents: [3, 3], properties: { id: "c1", anchor: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        v1: { type: "point", id: "v1", colorScheme: 0, x: 0, y: 6, labelOption: "none" },
        v2: { type: "point", id: "v2", colorScheme: 0, x: 6, y: 6, labelOption: "none" },
        v3: { type: "point", id: "v3", colorScheme: 0, x: 6, y: 0, labelOption: "none" },
        v4: { type: "point", id: "v4", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p1: { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3", "v4"]},
        c1: { type: "comment", id: "c1", anchors: ["p1"], x: 3, y: 3 }
      }
    });
  });

  it("should migrate polygons with comments at updated locations", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 6], properties: { id: "v1" } },
      { operation: "create", target: "point", parents: [6, 6], properties: { id: "v2" } },
      { operation: "create", target: "point", parents: [6, 0], properties: { id: "v3" } },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "v4" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } },
      { operation: "create", target: "comment", properties: { id: "c1", anchor: "p1" } },
      { operation: "update", target: "object", targetID: "c1", properties: { position: [5, 5] } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 6], properties: { id: "v1" } },
        { type: "point", parents: [6, 6], properties: { id: "v2" } },
        { type: "point", parents: [6, 0], properties: { id: "v3" } },
        { type: "point", parents: [0, 0], properties: { id: "v4" } },
        { type: "polygon", parents: ["v1", "v2", "v3", "v4"], properties: { id: "p1" } },
        { type: "comment", parents: [2, 2], properties: { id: "c1", anchor: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        v1: { type: "point", id: "v1", colorScheme: 0, x: 0, y: 6, labelOption: "none" },
        v2: { type: "point", id: "v2", colorScheme: 0, x: 6, y: 6, labelOption: "none" },
        v3: { type: "point", id: "v3", colorScheme: 0, x: 6, y: 0, labelOption: "none" },
        v4: { type: "point", id: "v4", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        p1: { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3", "v4"]},
        c1: { type: "comment", id: "c1", anchors: ["p1"], x: 2, y: 2 }
      }
    });
  });

  it("should migrate vertex angles", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "v1" } },
      { operation: "create", target: "point", parents: [5, 0], properties: { id: "v2" } },
      { operation: "create", target: "point", parents: [0, 5], properties: { id: "v3" } },
      { operation: "create", target: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p1" } },
      { operation: "create", target: "vertexAngle", parents: ["v1", "v2", "v3"], properties: { id: "a1" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "v1" } },
        { type: "point", parents: [5, 0], properties: { id: "v2" } },
        { type: "point", parents: [0, 5], properties: { id: "v3" } },
        { type: "polygon", parents: ["v1", "v2", "v3"], properties: { id: "p1" } },
        { type: "vertexAngle", parents: ["v1", "v2", "v3"], properties: { id: "a1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        v1: { type: "point", id: "v1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
        v2: { type: "point", id: "v2", colorScheme: 0, x: 5, y: 0, labelOption: "none" },
        v3: { type: "point", id: "v3", colorScheme: 0, x: 0, y: 5, labelOption: "none" },
        p1: { type: "polygon", id: "p1", colorScheme: 0, labelOption: "none", points: ["v1", "v2", "v3"]},
        a1: { type: "vertexAngle", id: "a1", points: ["v1", "v2", "v3"] }
      }
    });
  });

  it("should migrate movable lines", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "movableLine", parents: [[0, 0], [5, 5]], properties: { id: "l1" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        {
          type: "movableLine",
          parents: [
            { "type": "point", "parents": [0, 0] },
            { "type": "point", "parents": [5, 5] }
          ],
          properties: { id: "l1" }
        }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        l1: { type: "movableLine", id: "l1", colorScheme: 0,
              p1: { type: "point", id: "l1-point1", colorScheme: 0, x: 0, y: 0, labelOption: "none" },
              p2: { type: "point", id: "l1-point2", colorScheme: 0, x: 5, y: 5, labelOption: "none" } }
      }
    });
  });

  it("should migrate movable lines that have been moved", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "movableLine", parents: [[0, 0], [5, 5]], properties: { id: "l1" } },
      { operation :"update", target: "point", targetID: ["l1-point1", "l1-point2"],
        properties: [{ position: [0, 5] }, { position: [5, 10] }] }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        {
          type: "movableLine",
          parents: [
            { "type": "point", "parents": [0, 5] },
            { "type": "point", "parents": [5, 10] }
          ],
          properties: { id: "l1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps, objects: {
        l1: { type: "movableLine", id: "l1", colorScheme: 0,
              p1: { type: "point", id: "l1-point1", colorScheme: 0, x: 0, y: 5, labelOption: "none" },
              p2: { type: "point", id: "l1-point2", colorScheme: 0, x: 5, y: 10, labelOption: "none" } }
      }
    });
  });

  it("should not export movable lines without ids", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "movableLine", parents: [[0, 0], [5, 5]] }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual(kDefaultModelProps);
  });

  it("should not export movable lines (or their points) that have been deleted", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "movableLine", parents: [[0, 0], [5, 5]], properties: { id: "l1" } },
      { operation: "delete", target: "movableLine", targetID: "l1" }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual(kDefaultModelProps);
  });

  it("should migrate background images", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "image", parents: [kLocalImageUrl, [0, 0], [10, 10]], properties: { id: "i1" } }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "image", parents: { url: kLocalImageUrl, coords: [0, 0], size: [10, 10] }, properties: { id: "i1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual({
      ...kDefaultModelProps,
      bgImage: { type: "image", id: "i1", url: "assets/logo_tw.png", x: 0, y: 0, width: 10, height: 10 },
      objects: {}
    });
  });

  it("should not export background images that have been deleted", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "image", parents: [kLocalImageUrl, [0, 0], [10, 10]], properties: { id: "i1" } },
      { operation: "delete", target: "image", targetID: "i1" }
    ];
    expect(convertChangesToJson(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);

    expect(convertChangesToModelSnapshot(changes)).toEqual(kDefaultModelProps);
  });

});
