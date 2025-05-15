import { getSnapshot } from "mobx-state-tree";
import { EllipseObjectSnapshot } from "../objects/ellipse";
import { ImageObjectSnapshot } from "../objects/image";
import { LineObjectSnapshot } from "../objects/line";
import { RectangleObjectSnapshot } from "../objects/rectangle";
import { GroupObjectSnapshot, GroupObjectType } from "../objects/group";
import { VectorObjectSnapshot } from "../objects/vector";
import { DrawingMigrator } from "./drawing-migrator";

// Required import since it registers the group types
import "../drawing-registration";

// mock uniqueId so we can recognize auto-generated IDs
let idCount = 0;
jest.mock("../../../utilities/js-utils", () => {
  const { uniqueId, ...others } = jest.requireActual("../../../utilities/js-utils");
  return {
    uniqueId: () => `testid-${++idCount}`,
    ...others
  };
});

describe("import drawing", () => {

  beforeEach(() => {
    idCount = 0;
  });

  function importToObjects(input: any) {
    const imported = DrawingMigrator.create(input);
    return getSnapshot(imported).objects;
  }

  it("should import vectors (simple lines)", () => {
    const vectorData: VectorObjectSnapshot = {
      type: "vector",
      x: 10, y: 10,
      dx: 10, dy: 10,
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true
    };
    const input = { type: "Drawing" as const, objects: [vectorData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...vectorData, id: "testid-1" });

    const vectorDataWithId = { ...vectorData, id: "vector-id" };
    const inputWithId = { type: "Drawing" as const, objects: [vectorDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(vectorDataWithId);
  });

  it("should import lines (polylines)", () => {
    const lineData: LineObjectSnapshot = {
      type: "line",
      x: 10, y: 10,
      deltaPoints: [{ dx: 10, dy: 10 }, { dx: 5, dy: 5 }],
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true
    };
    const input = { type: "Drawing" as const, objects: [lineData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...lineData, id: "testid-1" });

    const lineDataWithId = { ...lineData, id: "line-id" };
    const inputWithId = { type: "Drawing" as const, objects: [lineDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(lineDataWithId);
  });

  it("should import rectangles", () => {
    const rectData: RectangleObjectSnapshot = {
      type: "rectangle",
      x: 10, y: 10,
      width: 10, height: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true
    };
    const input = { type: "Drawing" as const, objects: [rectData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...rectData, id: "testid-1" });

    const rectDataWithId = { ...rectData, id: "rect-id" };
    const inputWithId = { type: "Drawing" as const, objects: [rectDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(rectDataWithId);
  });

  it("should import ellipses", () => {
    const ellipseData: EllipseObjectSnapshot = {
      type: "ellipse",
      x: 10, y: 10,
      rx: 10, ry: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true
    };
    const input = { type: "Drawing" as const, objects: [ellipseData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...ellipseData, id: "testid-1" });

    const ellipseDataWithId = { ...ellipseData, id: "ellipse-id" };
    const inputWithId = { type: "Drawing" as const, objects: [ellipseDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(ellipseDataWithId);
  });

  it("should import images", () => {
    const imageData: ImageObjectSnapshot = {
      type: "image",
      url: "my/image/url",
      x: 10, y: 10,
      width: 10, height: 10,
      visible: true
    };
    const input = { type: "Drawing" as const, objects: [imageData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...imageData, id: "testid-1" });

    const imageDataWithId = { ...imageData, id: "image-id" };
    const inputWithId = { type: "Drawing" as const, objects: [imageDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(imageDataWithId);
  });

  it("should import simple v1.1.0 groups", () => {
    const groupData = {
      type: "group",
      x: 0, y: 0,
      width: 40, height: 40,
      visible: true,
      objects: [
        {
          type: "rectangle",
          x: 0, y: 0,
          width: .25, height: .25,
          fill: "#cccccc",
          stroke: "#888888",
          strokeDashArray: "3,3",
          strokeWidth: 1,
          visible: true
        },
        {
          type: "rectangle",
          x: .75, y: .75,
          width: .25, height: .25,
          visible: true,
          stroke: "#000000",
          strokeDashArray: "",
          strokeWidth: 2,
          fill: "none"
        }
      ]
    };
    const input = { type: "Drawing" as const, objects: [groupData], version: "1.1.0" as const };

    // Adds IDs if none are provided
    const target = { ...groupData, id: "testid-1" };
    (target.objects[0] as any).id = "testid-2";
    (target.objects[1] as any).id = "testid-3";
    expect(importToObjects(input)[0]).toEqual(target);

    // Preserves IDs if they are provided
    const groupDataWithId: GroupObjectSnapshot = {
      ...groupData,
      id: "different-id-1",
      objects: [
      { ...groupData.objects?.[0], id: "different-id-2" },
      { ...groupData.objects?.[1], id: "different-id-3" }
    ]};
    const inputWithId = { type: "Drawing" as const, objects: [groupDataWithId], version: "1.1.0" as const };

    expect(importToObjects(inputWithId)[0]).toEqual(groupDataWithId);
  });

  it("should import and update simple v1.0.0 groups", () => {
    const groupData = {
      type: "group",
      x: 0, y: 0,
      visible: true,
      objects: [
        {
          type: "rectangle",
          x: 0, y: 0,
          width: 10, height: 10,
          fill: "#cccccc",
          stroke: "#888888",
          strokeDashArray: "3,3",
          strokeWidth: 1,
          visible: true
        },
        {
          type: "rectangle",
          x: 30, y: 30,
          width: 10, height: 10,
          visible: true,
          stroke: "#000000",
          strokeDashArray: "",
          strokeWidth: 2,
          fill: "none"
        }
      ],
      objectExtents: { "whatever": "stuff" }
    };
    const input = { type: "Drawing" as const, objects: [groupData], version: "1.0.0" as const };

    // Calling importToObjects here fails due to an MST bug.
    // See `mst.test.ts` "lifecycle hooks of snapshot children are delayed until they are accessed"
    // If we just instantiate the model and then immediately call getSnapshot, the group's
    // afterCreate hook does not get called.
    // So in this case we just call `create` and do our testing on the actual model.
    const drawing = DrawingMigrator.create(input);

    const group = drawing.objects[0] as GroupObjectType;
    expect(drawing.objects.length).toBe(1);

    expect(group.type).toEqual("group");
    expect(group.id).toEqual("testid-1");
    expect(group.visible).toBe(true);
    expect(group.objects?.length).toBe(2);
    expect(group.objects?.[0].type).toBe("rectangle");
    expect(group.objects?.[1].type).toBe("rectangle");

    // Group should have the outer bounds of the objects
    expect(group.x).toBe(0);
    expect(group.y).toBe(0);
    expect(group.width).toBe(40);
    expect(group.height).toBe(40);

    // Objects should have positions and dimensions relative to the group
    expect(group.objects?.[0].x).toBe(0);
    expect(group.objects?.[0].y).toBe(0);
    expect((group.objects?.[0] as any).width).toBe(.25);
    expect((group.objects?.[0] as any).height).toBe(.25);
    expect(group.objects?.[1].x).toBe(.75);
    expect(group.objects?.[1].y).toBe(.75);
    expect((group.objects?.[1] as any).width).toBe(.25);
    expect((group.objects?.[1] as any).height).toBe(.25);
  });

  it("migrates v1.0.0 groups to v1.1.0 structure with correct children and properties", () => {
    const v1Snapshot = {
      type: "Drawing",
      version: "1.0.0",
      objects: [
        {
          type: "group",
          id: "Umzhcj2ZjNMoSfG_",
          x: 0,
          y: 0,
          visible: true,
          objects: [
            {
              type: "line",
              id: "WwGtGPkTNUJHSePK",
              x: 40,
              y: 40,
              visible: true,
              stroke: "#000000",
              strokeDashArray: "",
              strokeWidth: 2,
              deltaPoints: [
                {"dx": 0.2265625, "dy": 0.45703125},
                {"dx": 0.2265625, "dy": 0.45703125},
                {"dx": 5.0390625, "dy": 6.59375},
              ]
            },
            {
              type: "vector",
              id: "mmg0c8kPyy2dcqMd",
              x: 76.72265625,
              y: 66.19921875,
              visible: true,
              stroke: "#000000",
              strokeDashArray: "",
              strokeWidth: 2,
              dx: 12.47265625,
              dy: -10.76171875
            }
          ],
          objectExtents: {
            "WwGtGPkTNUJHSePK": {
              "top": 0,
              "right": 0.2455104755570336,
              "bottom": 0.7241893402907194,
              "left": 0
            },
            "mmg0c8kPyy2dcqMd": {
              "top": 0.48658218412225124,
              "right": 1,
              "bottom": 1,
              "left": 0.7345360824742269
            }
          }
        },
        {
          type: "group",
          id: "8vW3e2Pay0J2RBz9",
          x: 0,
          y: 0,
          visible: true,
          objects: [
            {
              type: "rectangle",
              id: "W8vFB2QDDEqB3p-F",
              x: 140.42578125,
              y: 49.7265625,
              visible: true,
              stroke: "#000000",
              strokeDashArray: "",
              strokeWidth: 2,
              fill: "none",
              width: 16.1953125,
              height: 17.9375
            },
            {
              type: "ellipse",
              id: "-lpT4O5pYHcFILf_",
              x: 205.65625,
              y: 42.8203125,
              visible: true,
              stroke: "#000000",
              strokeDashArray: "",
              strokeWidth: 2,
              fill: "none",
              rx: 25.22265625,
              ry: 27.3359375
            }
          ],
          objectExtents: {
            "W8vFB2QDDEqB3p-F": {
              "top": 0.6263218062303515,
              "right": 0.17904646743824496,
              "bottom": 0.9544155472992284,
              "left": 0
            },
            "-lpT4O5pYHcFILf_": {"top": 0, "right": 1, "bottom": 1, "left": 0.4423043703575747}
          }
        }
      ],
      stroke: "#000000",
      fill: "none",
      strokeDashArray: "",
      strokeWidth: 2,
      stamps: [
        {"url": "sas/stamps/black-chip.png", "width": 25, "height": 25}
      ]
    };
    const migrated = DrawingMigrator.create(v1Snapshot);
    const snap = getSnapshot(migrated);

    // There should be two groups
    expect(migrated.objects.length).toBe(2);
    migrated.objects.forEach((group: any) => {
      // objectExtents should be removed
      expect("objectExtents" in group).toBe(false);

      // width and height should be set (and > 0 after assimilation)
      expect(group.width).toBeGreaterThan(0);
      expect(group.height).toBeGreaterThan(0);
      // Each group should have two objects
      expect(group.objects.length).toBe(2);
      // Each object should have its dimensions inside the scaled [0,1] of the group
      // And these should match the objectExtents in the v1 snapshot
      group.objects.forEach((obj: any) => {
        expect(obj.x).toBeGreaterThanOrEqual(0);
        expect(obj.x).toBeLessThanOrEqual(1);
        expect(obj.y).toBeGreaterThanOrEqual(0);
        expect(obj.y).toBeLessThanOrEqual(1);

        if ("width" in obj) {
          expect(obj.width).toBeGreaterThanOrEqual(0);
          expect(obj.width).toBeLessThanOrEqual(1);
        }
        if ("height" in obj) {
          expect(obj.height).toBeGreaterThanOrEqual(0);
          expect(obj.height).toBeLessThanOrEqual(1);
        }
        if ("rx" in obj) {
          expect(obj.rx).toBeGreaterThanOrEqual(0);
          expect(obj.rx).toBeLessThanOrEqual(1);
        }
        if ("ry" in obj) {
          expect(obj.ry).toBeGreaterThanOrEqual(0);
          expect(obj.ry).toBeLessThanOrEqual(1);
        }
        if ("dx" in obj) {
          expect(obj.dx).toBeGreaterThanOrEqual(-1);
          expect(obj.dx).toBeLessThanOrEqual(1);
        }
        if ("dy" in obj) {
          expect(obj.dy).toBeGreaterThanOrEqual(-1);
          expect(obj.dy).toBeLessThanOrEqual(1);
        }
      });
    });
    // Version should be updated
    expect(snap.version).toBe("1.1.0");
  });
});
