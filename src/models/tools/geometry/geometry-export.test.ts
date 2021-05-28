import { safeJsonParse } from "../../../utilities/js-utils";
import { exportGeometryJson } from "./geometry-export";
import { preprocessImportFormat } from "./geometry-import";
import { JXGChange } from "./jxg-changes";

const exportGeometry = (changes: JXGChange[]) => {
  const changesJson = changes.map(change => JSON.stringify(change));
  const exportJson = exportGeometryJson(changesJson);
  const exportJs = safeJsonParse(exportJson);
  // log the JSON on error for debugging
  !exportJs && console.log("JSON PARSE ERROR\n----------------\n", exportJson);
  return exportJs;
};

// verify that export => import => export results in two identical exports
export const testRoundTrip = (changes: JXGChange[]) => {
  const exportJs = exportGeometry(changes);
  const importResult = preprocessImportFormat(exportJs);
  const importChanges = importResult.changes.map((change: string) => safeJsonParse(change));
  return [exportGeometry(importChanges), exportJs];
};

describe("Geometry Export", () => {
  it("should handle invalid exports", () => {
    expect(exportGeometry([])).toEqual({ type: "Geometry", objects: [] });
    expect(exportGeometry([null as any])).toEqual({ type: "Geometry", objects: [] });
  });

  it("should export board that has just been created", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: []
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export board with default units if necessary", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1] }
      }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: []
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export board that has also been updated", () => {
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
    expect(exportGeometry(changes)).toEqual({
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
  });

  it("should export board that has been partially updated", () => {
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
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: {
        properties: {
          axisMin: [-2, -1],
          axisRange: [30, 20]
        }
      },
      objects: []
    });
  });

  it("should export title", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "update", target: "metadata", properties: { title: "My Geometry" } }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      title: "My Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: []
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
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
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: []
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export created points", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export multiple points created with a single change", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [[0, 0], [5, 5]], properties: [{ id: "p1" }, { id: "p2" }] }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [5, 5], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export updated points", () => {
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
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } },
        { type: "point", parents: [2, 2], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export points with additional properties", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "point", parents: [0, 0], properties: { id: "p1", foo: "bar" } },
      { operation: "create", target: "point", parents: [5, 5], properties: { id: "p2" } }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1", foo: "bar" } },
        { type: "point", parents: [5, 5], properties: { id: "p2" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
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
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
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
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should not export linked points or polygons", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "tableLink", properties: { ids: ["lp1", "lp2", "lp3"] } },
      { operation: "create", target: "polygon", parents: ["lp1", "lp2", "lp3"], properties: { id: "lpoly"} }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should not export linked points or polygons", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "linkedPoint", parents: [0, 0], properties: { id: "lp1" } },
      { operation: "create", target: "linkedPoint", parents: [5, 5], properties: { id: "lp2" } },
      { operation: "create", target: "linkedPoint", parents: [5, 0], properties: { id: "lp3" } },
      { operation: "create", target: "polygon", parents: ["lp1", "lp2", "lp3"], properties: { id: "lpoly"} }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export polygons", () => {
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
    expect(exportGeometry(changes)).toEqual({
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
    expect(exportGeometry(changes)).toEqual({
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
  });

  it("should export polygon with only undeleted points", () => {
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
    expect(exportGeometry(changes)).toEqual({
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
  });

  it("should not export polygon with fewer than two points", () => {
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
      { operation: "delete", target: "point", targetID: "v2" },
      { operation: "delete", target: "point", targetID: "v3" }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "v1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export vertex angles", () => {
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
    expect(exportGeometry(changes)).toEqual({
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
  });

  it("should not export vertex angles with insufficient points", () => {
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
      { operation: "create", target: "vertexAngle", parents: ["v1", "v2", "v3"], properties: { id: "a1" } },
      { operation: "delete", target: "point", targetID: "v1" }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [5, 0], properties: { id: "v2" } },
        { type: "point", parents: [0, 5], properties: { id: "v3" } },
        { type: "polygon", parents: ["v2", "v3"], properties: { id: "p1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should not export vertex angles without parents", () => {
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
      { operation: "create", target: "vertexAngle", properties: { id: "a1" } }
    ];
    expect(exportGeometry(changes)).toEqual({
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
  });

  it("should not export vertex angles without polygons", () => {
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
      { operation: "create", target: "vertexAngle", parents: ["v1", "v2", "v3"], properties: { id: "a1" } },
      { operation: "delete", target: "polygon", targetID: "p1" }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "point", parents: [0, 0], properties: { id: "v1" } },
        { type: "point", parents: [5, 0], properties: { id: "v2" } },
        { type: "point", parents: [0, 5], properties: { id: "v3" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export movable lines", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "movableLine", parents: [[0, 0], [5, 5]], properties: { id: "l1" } }
    ];
    expect(exportGeometry(changes)).toEqual({
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
  });

  it("should export movable lines that have been moved", () => {
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
    expect(exportGeometry(changes)).toEqual({
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
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
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
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should export background images", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "image", parents: ["my/image/url", [0, 0], [10, 10]], properties: { id: "i1" } }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
        { type: "image", parents: { url: "my/image/url", coords: [0, 0], size: [183, 183] }, properties: { id: "i1" } }
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

  it("should not export background images that have been deleted", () => {
    const changes: JXGChange[] = [
      {
        operation: "create",
        target: "board",
        properties: { axis: true, boundingBox: [-2, 15, 22, -1], unitX: 20, unitY: 20 }
      },
      { operation: "create", target: "image", parents: ["my/image/url", [0, 0], [10, 10]], properties: { id: "i1" } },
      { operation: "delete", target: "image", targetID: "i1" }
    ];
    expect(exportGeometry(changes)).toEqual({
      type: "Geometry",
      board: { properties: { axisMin: [-2, -1], axisRange: [24, 16] } },
      objects: [
      ]
    });
    const [received, expected] = testRoundTrip(changes);
    expect(received).toEqual(expected);
  });

});
