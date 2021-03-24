import { preprocessImportFormat } from "./geometry-import";

const getImageMock = jest.fn();
jest.mock("../../image-map", () => ({
  gImageMap: {
    getImage: (...args: any[]) => getImageMock(...args)
  }
}));

describe("Geometry import", () => {
  it("ignores non-importable content", () => {
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
  });

  it ("imports points", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "point", parents: [0, 0] },
        { type: "point", parents: [5, 5], properties: { foo: "bar" }}
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(3);
    expect(JSON.parse(result.changes[2]).properties.foo).toBe("bar");
  });

  it ("imports points with comments", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "point", parents: [0, 0], comment: { text: "Point Comment"} }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(3);
    expect(JSON.parse(result.changes[2]).properties.text).toBe("Point Comment");
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
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(5);
    expect(JSON.parse(result.changes[1]).parents).toEqual([0, 0]);
    expect(JSON.parse(result.changes[2]).parents).toEqual([5, 0]);
    expect(JSON.parse(result.changes[3]).parents).toEqual([5, 5]);
  });

  it("imports polygons with angle labels", () => {
    const input = {
      type: "Geometry",
      objects: [
        { type: "polygon",
          parents: [
            { type: "point", parents: [0, 0], angleLabel :true },
            { type: "point", parents: [5, 0], angleLabel :true },
            { type: "point", parents: [5, 5], angleLabel :true }
          ]
        }
      ]
    };
    const result = preprocessImportFormat(input);
    expect(result.changes.length).toBe(8);
    expect(JSON.parse(result.changes[5]).target).toBe("vertexAngle");
    expect(JSON.parse(result.changes[6]).target).toBe("vertexAngle");
    expect(JSON.parse(result.changes[7]).target).toBe("vertexAngle");
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
  });
});
