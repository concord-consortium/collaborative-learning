import { clone, isEqualWith } from "lodash";
import { destroy, getSnapshot } from "mobx-state-tree";
import {
  GeometryContentModel, GeometryContentModelType, defaultGeometryContent, GeometryMetadataModel
} from "./geometry-content";
import {
  CommentModel, defaultBoard, ImageModel, MovableLineModel, PointModel, PolygonModel,
  PolygonModelType, segmentIdFromPointIds, VertexAngleModel, VertexAngleModelType
} from "./geometry-model";
import { kGeometryTileType } from "./geometry-types";
import { ESegmentLabelOption, JXGChange, JXGCoordPair } from "./jxg-changes";
import { isPointInPolygon, getPointsForVertexAngle, getPolygonEdge } from "./jxg-polygon";
import { canSupportVertexAngle, getVertexAngle, updateVertexAnglesFromObjects } from "./jxg-vertex-angle";
import {
  isBoard, isComment, isFreePoint, isImage, isLine, isMovableLine, isPoint, isPolygon,
  isText, kGeometryDefaultPixelsPerUnit, kGeometryDefaultXAxisMin, kGeometryDefaultYAxisMin
} from "./jxg-types";
import { TileModel, ITileModel } from "../tile-model";
import { getPoint, getPolygon } from "./geometry-utils";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../../register-tile-types";
registerTileTypes(["Geometry"]);

// Need to mock this so the placeholder that is added to the cache
// has dimensions
jest.mock( "../../../utilities/image-utils", () => ({
  ...(jest.requireActual("../../../utilities/image-utils") as any),
  getImageDimensions: jest.fn(() =>
    Promise.resolve({ src: "test-file-stub", width: 200, height: 150 }))
}));

import placeholderImage from "../../../assets/image_placeholder.png";

// mock Logger calls
const mockLogTileChangeEvent = jest.fn();
jest.mock("../log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent()
}));

// mock uniqueId so we can recognize auto-generated IDs
const { uniqueId, castArrayCopy, safeJsonParse, notEmpty } = jest.requireActual("../../../utilities/js-utils");
jest.mock("../../../utilities/js-utils", () => ({
  uniqueId: () => `testid-${uniqueId()}`,
  castArrayCopy: (itemOrArray: any) => castArrayCopy(itemOrArray),
  safeJsonParse: (json: string) => safeJsonParse(json),
  notEmpty: (value:any) => notEmpty(value)
}));

let message = () => "";

// for use with lodash's isEqualWith function to implement toEqualWithUniqueIds custom jest matcher
const customizer = (rec: any, exp: any) => {
  if (Array.isArray(rec) && Array.isArray(exp) && (rec?.length !== exp?.length)) {
    message = () =>
      `array lengths must be equal\n` +
      `  Expected: ${exp.length}\n` +
      `  Received: ${rec.length}`;
    return false;
  }
  if ((typeof rec === "object") && (typeof rec.id === "string") &&
      (typeof exp === "object") && (typeof exp.id === "string")) {
    const { id: recId, points: recPoints, anchors: recAnchors, ...recOthers } = rec;
    const { id: expId, points: expPoints, anchors: expAnchors, ...expOthers } = exp;
    const idsPass = recId !== expId;
    const pointsPass = !!(recPoints?.length === expPoints?.length) &&
            !!(expPoints?.every((ptId: string, i: number) => ptId !== recPoints[i]) ?? true);
    const anchorsPass = !!(recAnchors?.length === expAnchors?.length) &&
            !!(expAnchors?.every((_id: string, i: number) => _id !== recAnchors[i]) ?? true);
    const dependentsPass = pointsPass && anchorsPass;
    const propsPass = isEqualWith(recOthers, expOthers, customizer);
    if (!idsPass) message = () => "ids must be unique";
    if (!dependentsPass) {
      message = () =>
        `dependent point and anchor ids must be different:\n` +
        `  Expected: ${JSON.stringify(exp?.points)}\n` +
        `  Received: ${JSON.stringify(rec?.points)}`;
    }
    if (!propsPass) {
      message = () =>
        `object values must match:\n` +
        `  Expected: ${JSON.stringify(expOthers)}\n` +
        `  Received: ${JSON.stringify(recOthers)}`;
    }
    return idsPass && pointsPass && propsPass;
  }
};

// custom jest matcher for testing that copied objects are identical to the originals
// except for the object ids which should all be different.
expect.extend({
  toEqualWithUniqueIds(received: any, expected: any) {
    message = () => "";
    const pass = isEqualWith(received, expected, customizer);
    if (!pass && !message()) {
      message = () => "values differed outside of geometry objects";
    }
    return { pass, message };
  }
});
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEqualWithUniqueIds(expected: any): R
    }
  }
}

function buildPolygon(board: JXG.Board, content: GeometryContentModelType,
    coordinates: JXGCoordPair[], finalVertexClicked=0) {
  const points: JXG.Point[] = [];
  content.addPhantomPoint(board, [0, 0]);
  coordinates.forEach(pair => {
    const { point } = content.realizePhantomPoint(board, pair, true);
    if (point) points.push(point);
  });
  const polygon = content.closeActivePolygon(board, points[finalVertexClicked]);
  return { polygon, points };
}

describe("GeometryContent", () => {

  const divId = "1234";
  const divStyle = "width:200px;height:200px";
  document.body.innerHTML = `<div id="${divId}" style="${divStyle}"></div>`;

  function createDefaultBoard(content: GeometryContentModelType): JXG.Board {
    function onCreate(elt: JXG.GeometryElement) {
      // handle a point
    }
    const board = content.initializeBoard(divId, onCreate, (b) => {}) as JXG.Board;
    content.resizeBoard(board, 200, 200);
    content.updateScale(board, 0.5);
    return board;
  }

  function createContentAndBoard(
              configContent?: (content: GeometryContentModelType) => void):
              { content: GeometryContentModelType, board: JXG.Board } {
    const content = defaultGeometryContent();
    const metadata = GeometryMetadataModel.create({ id: "geometry-1" });
    content.doPostCreate!(metadata);
    if (configContent) configContent(content);
    const board = createDefaultBoard(content);
    return { content, board };
  }

  function createTileAndBoard(
      configContent?: (content: GeometryContentModelType) => void):
      { tile: ITileModel, board: JXG.Board } {
    const { content, board } = createContentAndBoard(configContent);
    const tile = TileModel.create({ content: getSnapshot(content) });
    return { tile, board };
  }

  function destroyContentAndBoard(content: GeometryContentModelType, board?: JXG.Board) {
    if (board) content.destroyBoard(board);
    destroy(content);
  }

  function destroyTileAndBoard(tile: ITileModel, board?: JXG.Board) {
    if (board) (tile.content as GeometryContentModelType).destroyBoard(board);
    destroy(tile);
  }

  // eslint-disable-next-line no-console
  const origConsoleLog = console.log;
  let consoleSpy: jest.SpyInstance;
  beforeAll(() => {
    // ignore console.logs from JSXGraph about lack of IntersectionObserver
    consoleSpy = jest.spyOn(console, "log").mockImplementation((...args: any[]) => {
      if (!args.some(arg => typeof arg === "string" && arg.includes("IntersectionObserver not available"))) {
        origConsoleLog(...args);
      }
    });
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it("can create with default properties", () => {
    const content = GeometryContentModel.create();
    expect(getSnapshot(content)).toEqual(
      { type: kGeometryTileType, board: defaultBoard(), objects: {}, linkedAttributeColors: {} });

    destroy(content);
  });

  it("can create with authored properties", () => {
    const authored = {
            type: kGeometryTileType,
            board: {
              properties: {
                axisNames: ["authorX", "authorY"]
              }
            },
            objects: []
          };
    const content = GeometryContentModel.create(authored as any);
    expect(getSnapshot(content)).toEqual({
      type: kGeometryTileType,
      board: {
        xAxis: { name: "authorX", min: kGeometryDefaultXAxisMin, unit: kGeometryDefaultPixelsPerUnit },
        yAxis: { name: "authorY", min: kGeometryDefaultYAxisMin, unit: kGeometryDefaultPixelsPerUnit }
      },
      objects: {},
      linkedAttributeColors: {}
    });

    destroy(content);
  });

  it("can create/destroy a JSXGraph board", () => {
    const { tile, board } = createTileAndBoard(_content => {
      _content.addObjectModel(PointModel.create({ x: 1, y: 1 }));
    });
    const content = tile.content as GeometryContentModelType;
    expect(isBoard(board)).toBe(true);

    content.resizeBoard(board, 200, 200);
    content.updateScale(board, 0.5);

    const boardId = board.id;
    const boundingBox = clone(board.attr.boundingbox);
    const change: JXGChange = {
            operation: "update",
            target: "board",
            targetID: boardId,
            properties: { boundingBox }
          };
    content.applyChange(board, change);

    const badChange: JXGChange = { operation: "update", target: "board", targetID: "foo" };
    content.applyChange(board, badChange);
    badChange.properties = {};
    content.applyChange(board, badChange);
    badChange.targetID = [boardId, boardId];
    badChange.properties = [{}];
    content.applyChange(board, badChange);

    content.syncChange(null as any as JXG.Board, null as any as JXGChange);

    // can delete board with change
    content.applyChange(board, { operation: "delete", target: "board", targetID: boardId });

    destroyTileAndBoard(tile);
  });

  it("can update axes parameters", () => {
    const { content, board } = createContentAndBoard();

    const params = {
      xName: "xName",
      xAnnotation: "xAnnotation",
      xMin: -1,
      xMax: 9,
      yName: "yName",
      yAnnotation: "yAnnotation",
      yMin: -2,
      yMax: 3
    };

    content.rescaleBoard(board, params);
    expect(content.board?.xAxis.name).toBe("xName");
    expect(content.board?.xAxis.label).toBe("xAnnotation");
    expect(content.board?.xAxis.min).toBe(-1);
    expect(content.board?.yAxis.name).toBe("yName");
    expect(content.board?.yAxis.label).toBe("yAnnotation");
    expect(content.board?.yAxis.min).toBe(-2);
    // Scales are forced to be equal, and Y axis is slightly longer than X axis
    expect(content.board?.xAxis.range).toBe(10);
    expect(content.board?.yAxis.range).toBeCloseTo(11.4286);

    const xAxis = content.board?.xAxis;
    if (xAxis) {
      xAxis.setName('x');
      expect(xAxis.name).toBe('x');
      xAxis.setLabel('xAxis');
      expect(xAxis.label).toBe('xAxis');
      xAxis.setMin(0);
      expect(xAxis.min).toBe(0);
      xAxis.setRange(20);
      expect(xAxis.range).toBe(20);
      xAxis.setUnit(2);
      expect(xAxis.unit).toBe(2);
    }

    destroyContentAndBoard(content, board);
  });

  it("can add/remove/update points", () => {
    const { content, board } = createContentAndBoard();
    expect(isBoard(board)).toBe(true);
    const p1Id = "point-1";
    let p1: JXG.Point = board.objects[p1Id] as JXG.Point;
    expect(p1).toBeUndefined();
    p1 = content.addPoint(board, [1, 1], { id: p1Id }) as JXG.Point;
    expect(content.lastObject).toEqual({ id: p1Id, type: "point", x: 1, y: 1, colorScheme: 0 });
    expect(isPoint(p1)).toBe(true);
    expect(isFreePoint(p1)).toBe(true);
    // won't create generic objects
    const obj = content.applyChange(board, { operation: "create", target: "object" });
    expect(obj).toBeUndefined();
    // ignores changes to unknown objects
    content.applyChange(board, { operation: "create", target: "foo" } as any as JXGChange);
    // auto-generates ids if asked to create a point without an id
    const p2Change: JXGChange = { operation: "create", parents: [0, 0], target: "point" };
    const p2: JXG.Point = content.applyChange(board, p2Change) as JXG.Point;
    expect(p2.id).toBeDefined();
    expect(p1.coords.usrCoords).toEqual([1, 1, 1]);
    expect(p1.getAttribute("fixed")).toBe(false);
    content.updateObjects(board, p1Id, { position: [2, 2] });
    expect(p1.coords.usrCoords).toEqual([1, 2, 2]);
    content.updateObjects(board, p1Id, { fixed: true });
    expect(p1.getAttribute("fixed")).toBe(true);
    content.updateObjects(board, [p1Id, p1Id], { fixed: false });
    expect(p1.getAttribute("fixed")).toBe(false);
    content.updateObjects(board, [p1Id, p1Id], [{ fixed: true }, { fixed: true }]);
    expect(p1.getAttribute("fixed")).toBe(true);
    content.updateObjects(board, "foo", { });
    content.applyChange(board, { operation: "update", target: "point" });
    content.removeObjects(board, p1Id); // should not be removed because it is "fixed"
    expect(board.objects[p1Id]).toBeDefined();
    content.updateObjects(board, [p1Id], { fixed: false });
    content.removeObjects(board, p1Id);
    expect(board.objects[p1Id]).toBeUndefined();
    const p3: JXG.Point = content.addPoint(board, [2, 2]) as JXG.Point;
    expect(p3.id.startsWith("testid-")).toBe(true);
    // requests to remove points with invalid IDs are ignored
    content.removeObjects(board, ["foo"]);
    content.applyChange(board, { operation: "delete", target: "point" });

    destroyContentAndBoard(content, board);
  });

  it("can add comments to points", () => {
    const { content, board } = createContentAndBoard();
    const p1Id = "point-1";
    content.addPoint(board, [1, 1], { id: p1Id }) as JXG.Point;
    expect(content.lastObject).toEqual({ id: p1Id, type: "point", x: 1, y: 1, colorScheme: 0 });

    // add comment to point
    const [comment] = content.addComment(board, p1Id)!;
    expect(content.lastObject).toEqual({ id: comment.id, type: "comment", anchors: [p1Id] });
    expect(isComment(comment)).toBe(true);

    // update comment text
    content.updateObjects(board, comment.id, { position: [5, 5], text: "new" });
    expect(content.lastObject).toEqual({ id: comment.id, type: "comment", anchors: [p1Id], x: 4, y: 4, text: "new" });

    destroyContentAndBoard(content, board);
  });

  it("can add/remove/update polygons", () => {
    const { content, board } = createContentAndBoard();
    const { polygon, points } = buildPolygon(board, content, [[1, 1], [3, 3], [5, 1]]);
    expect(content.lastObjectOfType("polygon")).toEqual({
      id: polygon?.id, type: "polygon", points: [ points[0].id, points[1].id, points[2].id ], colorScheme: 0 });
    expect(isPolygon(polygon)).toBe(true);
    const polygonId = polygon?.id;
    expect(content.getDependents([points[0].id])).toEqual([points[0].id, polygonId]);
    expect(content.getDependents([points[0].id], { required: true })).toEqual([points[0].id]);
    expect(content.getDependents([points[2].id])).toEqual([points[2].id, polygonId]);
    expect(content.getDependents([points[2].id||''], { required: true })).toEqual([points[2].id]);

    const ptInPolyCoords = new JXG.Coords(JXG.COORDS_BY_USER, [3, 2], board);
    const [, ptInScrX, ptInScrY] = ptInPolyCoords.scrCoords;
    expect(polygon && isPointInPolygon(ptInScrX, ptInScrY, polygon)).toBe(true);
    const ptOutPolyCoords = new JXG.Coords(JXG.COORDS_BY_USER, [4, 4], board);
    const [, ptOutScrX, ptOutScrY] = ptOutPolyCoords.scrCoords;
    expect(polygon && isPointInPolygon(ptOutScrX, ptOutScrY, polygon)).toBe(false);

    polygonId && content.removeObjects(board, polygonId);
    expect(polygonId && content.getObject(polygonId)).toBeUndefined();
    expect(board.objects[polygonId||'']).toBeUndefined();
    // can't create polygon without vertices
    const badpoly = content.applyChange(board, { operation: "create", target: "polygon" }) as any as JXG.Polygon;
    expect(badpoly).toBeUndefined();

    destroyContentAndBoard(content, board);
  });

  it("handles vertex angles in polygons properly", () => {
    let polygonId;
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "p1", x: 1, y: 1 }));
      _content.addObjectModel(PointModel.create({ id: "p2", x: 3, y: 3 }));
      _content.addObjectModel(PointModel.create({ id: "p3", x: 5, y: 1 }));
      _content.addObjectModel(PointModel.create({ id: "p5", x: 10, y: 7 }));
      polygonId = _content.addObjectModel(PolygonModel.create({ points: ["p1", "p2", "p3"] }));
    });
    assertIsDefined(polygonId);
    const poly = content.getObject(polygonId) as PolygonModelType;
    content.addVertexAngle(board, ["p3", "p1", "p2"], { id: "va1" });
    content.addVertexAngle(board, ["p1", "p2", "p3"], { id: "va2" });
    content.addVertexAngle(board, ["p2", "p3", "p1"], { id: "va3" });

    expect(getPolygon(board, polygonId)!.vertices.map(v=>v.id)).toEqual(["p1", "p2", "p3", "p1"]);
    expect(poly.points).toEqual(["p1", "p2", "p3"]);
    expect((content.getObject("va1") as VertexAngleModelType).points).toEqual(["p3", "p1", "p2"]);

    // Simulate going back into polygon mode, clicking one of the vertices, and adding some points to the polygon
    const p4 = content.addPhantomPoint(board, [1, 1])!;
    content.makePolygonActive(board, polygonId, "p2");
    expect(poly.points).toEqual(["p3", "p1", "p2"]);
    expect(getPolygon(board, polygonId)!.vertices.map(v=>v.id)).toEqual(["p3", "p1", "p2", p4.id, "p3"]);
    expect((content.getObject("va1") as VertexAngleModelType).points).toEqual(["p3", "p1", "p2"]);
    expect((content.getObject("va2") as VertexAngleModelType).points).toEqual(["p1", "p2", p4.id]);
    expect((content.getObject("va3") as VertexAngleModelType).points).toEqual([p4.id, "p3", "p1"]);

    content.realizePhantomPoint(board, [1, 1], true);
    const p6 = content.phantomPoint!;
    expect(poly.points).toEqual(["p3", "p1", "p2", p4.id]);
    expect(getPolygon(board, polygonId)!.vertices.map(v=>v.id)).toEqual(["p3", "p1", "p2", p4.id, p6.id, "p3"]);
    expect((content.getObject("va1") as VertexAngleModelType).points).toEqual(["p3", "p1", "p2"]);
    expect((content.getObject("va2") as VertexAngleModelType).points).toEqual(["p1", "p2", p4.id]);
    expect((content.getObject("va3") as VertexAngleModelType).points).toEqual([p6.id, "p3", "p1"]);

    content.addPointToActivePolygon(board, "p5");
    expect(poly.points).toEqual(["p3", "p1", "p2", p4.id, "p5"]);
    expect(getPolygon(board, polygonId)!.vertices.map(v=>v.id)).toEqual(["p3", "p1", "p2", p4.id, "p5", p6.id, "p3"]);
    expect((content.getObject("va1") as VertexAngleModelType).points).toEqual(["p3", "p1", "p2"]);
    expect((content.getObject("va2") as VertexAngleModelType).points).toEqual(["p1", "p2", p4.id]);
    expect((content.getObject("va3") as VertexAngleModelType).points).toEqual([p6.id, "p3", "p1"]);

    // Shortcut polygon by clicking p1 rather than the expected p3. p3 gets cut out.
    content.closeActivePolygon(board, getPoint(board, "p1")!);
    expect(poly.points).toEqual(["p1", "p2", p4.id, "p5"]);
    expect(getPolygon(board, polygonId)!.vertices.map(v=>v.id)).toEqual(["p1", "p2", p4.id, "p5", "p1"]);
    expect((content.getObject("va1") as VertexAngleModelType).points).toEqual(["p5", "p1", "p2"]);
    expect((content.getObject("va2") as VertexAngleModelType).points).toEqual(["p1", "p2", p4.id]);
    expect(content.getObject("va3")).toBeUndefined();
  });

  it("can short-circuit a polygon", () => {
    const { content, board } = createContentAndBoard();
    const { polygon, points } = buildPolygon(board, content, [[1, 1], [3, 3], [7, 4], [5, 1]], 1);
    expect(content.lastObjectOfType("polygon")).toEqual({
      id: polygon?.id, type: "polygon", points: [ points[1].id, points[2].id, points[3].id ], colorScheme: 0 });
    expect(isPolygon(polygon)).toBe(true);
    const polygonId = polygon?.id;
    // point 0 should have been freed
    expect(content.getDependents([points[0].id])).toEqual([points[0].id]);
    expect(content.getDependents([points[0].id], { required: true })).toEqual([points[0].id]);
    // the rest of the points are in the poly
    expect(content.getDependents([points[1].id])).toEqual([points[1].id, polygonId]);
    expect(content.getDependents([points[1].id], { required: true })).toEqual([points[1].id]);
    expect(content.getDependents([points[2].id])).toEqual([points[2].id, polygonId]);
    expect(content.getDependents([points[2].id||''], { required: true })).toEqual([points[2].id]);
    expect(content.getDependents([points[3].id])).toEqual([points[3].id, polygonId]);
    expect(content.getDependents([points[3].id||''], { required: true })).toEqual([points[3].id]);
    destroyContentAndBoard(content, board);
  });

  it("can make two polygons that share a vertex", () => {
    const { content, board } = createContentAndBoard();
    // first polygon
    const { polygon, points } = buildPolygon(board, content, [[0, 0], [1, 1], [2, 2]]); // points 0, 1, 2
    if (!isPolygon(polygon)) fail("buildPolygon did not return a polygon");
    // second polygon
    points.push(content.realizePhantomPoint(board, [5, 5], true).point!); // point 3
    points.push(content.realizePhantomPoint(board, [4, 4], true).point!); // point 4
    content.addPointToActivePolygon(board, points[2].id);
    const polygon2 = content.closeActivePolygon(board, points[3]);
    if (!isPolygon(polygon2)) fail("addPointToActivePolygon did not return a polygon");
    expect(polygon.vertices.map(v => v.id)).toEqual([points[0].id, points[1].id, points[2].id, points[0].id]);
    expect(polygon2.vertices.map(v => v.id)).toEqual([points[3].id, points[4].id, points[2].id, points[3].id]);

    expect(content.getDependents([points[2].id])).toEqual([points[2].id, polygon.id, polygon2.id]);
  });

  it("can add/remove/update polygons from model", () => {
    let polygonId = "";
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "p1", x: 1, y: 1 }));
      _content.addObjectModel(PointModel.create({ id: "p2", x: 3, y: 3 }));
      _content.addObjectModel(PointModel.create({ id: "p3", x: 5, y: 1 }));
      polygonId = _content.addObjectModel(PolygonModel.create({ points: ["p1", "p2", "p3"] }));
    });
    let polygon: JXG.Polygon | undefined = board.objects[polygonId] as JXG.Polygon;
    expect(isPolygon(polygon)).toBe(true);
    expect(polygonId.startsWith("testid-")).toBe(true);

    const ptInPolyCoords = new JXG.Coords(JXG.COORDS_BY_USER, [3, 2], board);
    const [, ptInScrX, ptInScrY] = ptInPolyCoords.scrCoords;
    expect(isPointInPolygon(ptInScrX, ptInScrY, polygon)).toBe(true);
    const ptOutPolyCoords = new JXG.Coords(JXG.COORDS_BY_USER, [4, 4], board);
    const [, ptOutScrX, ptOutScrY] = ptOutPolyCoords.scrCoords;
    expect(isPointInPolygon(ptOutScrX, ptOutScrY, polygon)).toBe(false);

    content.removeObjects(board, polygonId);
    expect(content.getObject(polygonId)).toBeUndefined();
    expect(board.objects[polygonId]).toBeUndefined();
    // can't create polygon without vertices
    polygon = content.applyChange(board, { operation: "create", target: "polygon" }) as any as JXG.Polygon;
    expect(polygon).toBeUndefined();

    destroyContentAndBoard(content, board);
  });

  it("can add comments to polygons", () => {
    const { content, board } = createContentAndBoard();

    const { polygon } = buildPolygon(board, content, [[0, 0], [0, 2], [2, 2], [2, 0]]);
    expect(polygon).toBeTruthy();
    // add comment to polygon
    const [comment] = content.addComment(board, polygon!.id)!;
    expect(content.lastObject).toEqual({ id: comment.id, type: "comment", anchors: [polygon!.id] });
    expect(isComment(comment)).toBe(true);

    // update comment text
    content.updateObjects(board, comment.id, { position: [5, 5], text: "new" });
    expect(content.lastObject).toEqual(
      // This used to be "x:4". Not sure why this changed.
      { id: comment.id, type: "comment", anchors: [polygon!.id], x: 4.5, y: 4, text: "new" });

    destroyContentAndBoard(content, board);
  });

  it("can add/remove/update polygons from model", () => {
    let polygonId = "";
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "p1", x: 1, y: 1 }));
      _content.addObjectModel(PointModel.create({ id: "p2", x: 3, y: 3 }));
      _content.addObjectModel(PointModel.create({ id: "p3", x: 5, y: 1 }));
      polygonId = _content.addObjectModel(PolygonModel.create({ points: ["p1", "p2", "p3"] }));
    });
    let polygon: JXG.Polygon | undefined = board.objects[polygonId] as JXG.Polygon;
    expect(isPolygon(polygon)).toBe(true);
    expect(polygonId.startsWith("testid-")).toBe(true);

    const ptInPolyCoords = new JXG.Coords(JXG.COORDS_BY_USER, [3, 2], board);
    const [, ptInScrX, ptInScrY] = ptInPolyCoords.scrCoords;
    expect(isPointInPolygon(ptInScrX, ptInScrY, polygon)).toBe(true);
    const ptOutPolyCoords = new JXG.Coords(JXG.COORDS_BY_USER, [4, 4], board);
    const [, ptOutScrX, ptOutScrY] = ptOutPolyCoords.scrCoords;
    expect(isPointInPolygon(ptOutScrX, ptOutScrY, polygon)).toBe(false);

    content.removeObjects(board, polygonId);
    expect(board.objects[polygonId]).toBeUndefined();
    // can't create polygon without vertices
    polygon = content.applyChange(board, { operation: "create", target: "polygon" }) as any as JXG.Polygon;
    expect(polygon).toBeUndefined();

    destroyContentAndBoard(content, board);
  });

  it("can add/remove polygons from model with segment labels", () => {
    let polygonId = "";
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "p1", x: 1, y: 1 }));
      _content.addObjectModel(PointModel.create({ id: "p2", x: 3, y: 3 }));
      _content.addObjectModel(PointModel.create({ id: "p3", x: 5, y: 1 }));
      polygonId = _content.addObjectModel(PolygonModel.create({
        points: ["p1", "p2", "p3"],
        colorScheme: 0,
        labels: [{ id: segmentIdFromPointIds(["p1", "p2"]), option: ESegmentLabelOption.kLength }]
      }));
    });
    const polygon: JXG.Polygon | undefined = board.objects[polygonId] as JXG.Polygon;
    expect(isPolygon(polygon)).toBe(true);
    expect(polygonId.startsWith("testid-")).toBe(true);

    const pointPair: [string, string] = ["p1", "p2"];
    const segment = getPolygonEdge(board, polygonId, pointPair);
    expect(isLine(segment)).toBe(true);
    expect(isText(segment?.label)).toBe(true);
    expect(typeof segment?.name).toBe("function");
    const polygonModel = content.getObject(polygonId) as PolygonModelType;
    expect(polygonModel.hasSegmentLabel(pointPair)).toBe(true);
    expect(polygonModel.getSegmentLabel(pointPair)).toBeDefined();

    const segment2 = getPolygonEdge(board, polygonId, ["p2", "p3"]);
    expect(isLine(segment2)).toBe(true);
    expect(isText(segment2?.label)).toBe(false);
    expect(typeof segment2?.name).not.toBe("function");

    const p1 = board.objects.p1 as JXG.Point;
    const p2 = board.objects.p2 as JXG.Point;
    const p3 = board.objects.p3 as JXG.Point;
    content.updatePolygonSegmentLabel(board, polygon, [p1, p2], ESegmentLabelOption.kLabel);
    expect(content.getObject(polygon.id)).toEqual({
      id: polygonId,
      type: "polygon",
      points: ["p1", "p2", "p3"],
      colorScheme: 0,
      labels: [{ id: segmentIdFromPointIds(["p1", "p2"]), option: ESegmentLabelOption.kLabel }]
    });
    content.updatePolygonSegmentLabel(board, polygon, [p2, p3], ESegmentLabelOption.kLength);
    expect(content.getObject(polygon.id)).toEqual({
      id: polygonId,
      type: "polygon",
      points: ["p1", "p2", "p3"],
      colorScheme: 0,
      labels: [{ id: segmentIdFromPointIds(["p1", "p2"]), option: ESegmentLabelOption.kLabel },
               { id: segmentIdFromPointIds(["p2", "p3"]), option: ESegmentLabelOption.kLength }]
    });
    content.updatePolygonSegmentLabel(board, polygon, [p1, p2], ESegmentLabelOption.kNone);
    expect(content.getObject(polygon.id)).toEqual({
      id: polygonId,
      type: "polygon",
      colorScheme: 0,
      points: ["p1", "p2", "p3"],
      labels: [{ id: segmentIdFromPointIds(["p2", "p3"]), option: ESegmentLabelOption.kLength }]
    });

    content.removeObjects(board, polygonId);
    expect(board.objects[polygonId]).toBeUndefined();

    destroyContentAndBoard(content, board);
  });

  it("can add an image", () => {
    const { content, board } = createContentAndBoard();
    const image = content.addImage(board, placeholderImage, [0, 0], [5, 5]);
    expect(content.bgImage).toEqual({
      id: image!.id, type: "image", url: placeholderImage, x: 0, y: 0, width: 5, height: 5 });
    expect(image!.elType).toBe("image");
    content.updateObjects(board, image!.id, { url: placeholderImage });
    expect(image!.url).toBe(placeholderImage);
    content.updateObjects(board, image!.id, { size: [10, 10] });
    content.updateObjects(board, image!.id, { url: placeholderImage, size: [10, 10] });
    expect(image!.url).toBe(placeholderImage);

    const change: JXGChange = {
      operation: "create",
      target: "image",
      parents: [placeholderImage],
      properties: { id: "image-fail" }
    };
    const failedImage = content.applyChange(board, change);
    expect(failedImage).toBeUndefined();
    destroyContentAndBoard(content, board);
  });

  it("can add an image from model object", () => {
    const { content, board } = createContentAndBoard((_content) => {
      _content.setBackgroundImage(
        ImageModel.create({ id: "img", url: placeholderImage, x: 0, y: 0, width: 5, height: 5 }));
    });
    // const image = content.addImage(board, placeholderImage, [0, 0], [5, 5]);
    const image = board.objects.img as JXG.Image;
    expect(isImage(image)).toBe(true);
    expect(image.elType).toBe("image");
    content.updateObjects(board, image.id, { url: placeholderImage });
    expect(image.url).toBe(placeholderImage);
    content.updateObjects(board, image.id, { size: [10, 10] });
    content.updateObjects(board, image.id, { url: placeholderImage, size: [10, 10] });
    expect(image.url).toBe(placeholderImage);

    const change: JXGChange = {
      operation: "create",
      target: "image",
      parents: [placeholderImage],
      properties: { id: "image-fail" }
    };
    const failedImage = content.applyChange(board, change);
    expect(failedImage).toBeUndefined();
    destroyContentAndBoard(content, board);
  });

  it("can select points, etc.", () => {
    const { content, board } = createContentAndBoard();
    const { points, polygon } = buildPolygon(board, content, [[0, 0], [1, 1], [1, 0]]);
    const [p1, p2, p3] = points;
    expect(content.lastObjectOfType("polygon")).toEqual(
      { id: polygon?.id, type: "polygon", colorScheme: 0, points: [p1!.id, p2!.id, p3!.id] });
    content.selectObjects(board, p1!.id);
    expect(content.isSelected(p1!.id)).toBe(true);
    expect(content.isSelected(p2!.id)).toBe(false);
    expect(content.isSelected(p3!.id)).toBe(false);
    content.selectObjects(board, polygon!.id);
    expect(content.isSelected(polygon!.id)).toBe(true);
    expect(content.hasSelection()).toBe(true);
    let found = content.findObjects(board, (obj: JXG.GeometryElement) => obj.id === p1!.id);
    expect(found.length).toBe(1);
    content.deselectObjects(board, p1!.id);
    expect(content.isSelected(p1!.id)).toBe(false);
    content.deselectAll(board);
    expect(content.hasSelection()).toBe(false);
    content.selectObjects(board, p1!.id);
    content.deleteSelection(board);
    expect(content.hasSelection()).toBe(false);
    found = content.findObjects(board, (obj: JXG.GeometryElement) => obj.id === p1!.id);
    expect(found.length).toBe(0);
    content.deleteSelection(board);
    expect(found.length).toBe(0);
  });

  it("can add a vertex angle to a polygon", () => {
    const { content, board } = createContentAndBoard();
    const { points, polygon } = buildPolygon(board, content, [[0, 0], [1, 0], [0, 1]]);
    const [p0, px, py] = points;
    expect(content.lastObjectOfType("polygon")).toEqual(
      { id: polygon?.id, type: "polygon", colorScheme: 0, points: [p0!.id, px!.id, py!.id] });
    const pSolo: JXG.Point = content.addPoint(board, [9, 9])!;
    expect(canSupportVertexAngle(p0)).toBe(true);
    expect(canSupportVertexAngle(pSolo)).toBe(false);
    expect(getVertexAngle(p0)).toBeUndefined();
    const va0 = content.addVertexAngle(board, [px.id, p0.id, py.id]);
    expect(content.lastObject).toEqual({ type: "vertexAngle", id: va0!.id, points: [px.id, p0.id, py.id] });
    const vax = content.addVertexAngle(board, [py.id, px.id, p0.id]);
    expect(content.lastObject).toEqual({ type: "vertexAngle", id: vax!.id, points: [py.id, px.id, p0.id] });
    const vay = content.addVertexAngle(board, [p0.id, py.id, px.id]);
    expect(content.lastObject).toEqual({ type: "vertexAngle", id: vay!.id, points: [p0.id, py.id, px.id] });
    expect(getVertexAngle(p0)!.id).toBe(va0!.id);
    expect(getVertexAngle(px)!.id).toBe(vax!.id);
    expect(getVertexAngle(py)!.id).toBe(vay!.id);
    expect(content.getDependents([p0!.id])).toEqual([p0!.id, polygon!.id, va0!.id, vax!.id, vay!.id]);
    expect(content.getDependents([p0!.id], { required: true })).toEqual([p0!.id, va0!.id, vax!.id, vay!.id]);
    expect(getPointsForVertexAngle(pSolo)).toBeUndefined();
    expect(getPointsForVertexAngle(p0)!.map(p => p.id)).toEqual([px.id, p0.id, py.id]);
    expect(getPointsForVertexAngle(px)!.map(p => p.id)).toEqual([py.id, px.id, p0.id]);
    expect(getPointsForVertexAngle(py)!.map(p => p.id)).toEqual([p0.id, py.id, px.id]);
    p0.setPosition(JXG.COORDS_BY_USER, [1, 1]);
    updateVertexAnglesFromObjects([p0, px, py, polygon!]);
    expect(getPointsForVertexAngle(p0)!.map(p => p.id)).toEqual([py.id, p0.id, px.id]);

    content.removeObjects(board, [p0!.id]);
    expect(content.getObject(p0!.id)).toBeUndefined();
    // first point can be removed from polygon without deleting polygon
    expect(content.getObject(polygon!.id)).toEqual(
      { id: polygon?.id, type: "polygon", colorScheme: 0, points: [px!.id, py!.id] });
    // vertex angles are deleted when any dependent point is deleted
    expect(content.getObject(va0!.id)).toBeUndefined();
    expect(content.getObject(vax!.id)).toBeUndefined();
    expect(content.getObject(vay!.id)).toBeUndefined();

    // removing second point results in removal of polygon
    content.removeObjects(board, [px!.id]);
    expect(content.getObject(px!.id)).toBeUndefined();
    expect(content.getObject(polygon!.id)).toBeUndefined();

    expect(content.applyChange(board, { operation: "create", target: "vertexAngle" })).toBeUndefined();
  });

  it("can add a vertex angle to a polygon from model objects", () => {
    let polygonId = "";
    let vAngle0Id = "";
    let vAngleXId = "";
    let vAngleYId = "";
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "p0", x: 0, y: 0 }));
      _content.addObjectModel(PointModel.create({ id: "px", x: 1, y: 0 }));
      _content.addObjectModel(PointModel.create({ id: "py", x: 0, y: 1 }));
      polygonId = _content.addObjectModel(PolygonModel.create({ points: ["p0", "px", "py"] }));
      vAngle0Id = _content.addObjectModel(VertexAngleModel.create({ points: ["px", "p0", "py"] }));
      vAngleXId = _content.addObjectModel(VertexAngleModel.create({ points: ["py", "px", "p0"] }));
      vAngleYId = _content.addObjectModel(VertexAngleModel.create({ points: ["p0", "py", "px"] }));
    });
    const p0: JXG.Point = board.objects.p0 as JXG.Point;
    const px: JXG.Point = board.objects.px as JXG.Point;
    const py: JXG.Point = board.objects.py as JXG.Point;
    const poly: JXG.Polygon = board.objects[polygonId] as JXG.Polygon;
    const pSolo: JXG.Point = content.addPoint(board, [9, 9])!;
    expect(canSupportVertexAngle(p0)).toBe(true);
    expect(canSupportVertexAngle(pSolo)).toBe(false);
    expect(getVertexAngle(p0)!.id).toBe(vAngle0Id);
    expect(getVertexAngle(px)!.id).toBe(vAngleXId);
    expect(getVertexAngle(py)!.id).toBe(vAngleYId);
    expect(getPointsForVertexAngle(pSolo)).toBeUndefined();
    expect(getPointsForVertexAngle(p0)!.map(p => p.id)).toEqual([px.id, p0.id, py.id]);
    expect(getPointsForVertexAngle(px)!.map(p => p.id)).toEqual([py.id, px.id, p0.id]);
    expect(getPointsForVertexAngle(py)!.map(p => p.id)).toEqual([p0.id, py.id, px.id]);
    p0.setPosition(JXG.COORDS_BY_USER, [1, 1]);
    updateVertexAnglesFromObjects([p0, px, py, poly]);
    expect(getPointsForVertexAngle(p0)!.map(p => p.id)).toEqual([py.id, p0.id, px.id]);

    content.removeObjects(board, [p0!.id]);
    expect(content.getObject(p0!.id)).toBeUndefined();
    // first point can be removed from polygon without deleting polygon
    expect(content.getObject(poly!.id)).toEqual(
      { id: poly?.id, type: "polygon", colorScheme: 0, points: [px!.id, py!.id] });
    // vertex angles are deleted when any dependent point is deleted
    expect(content.getObject(vAngle0Id)).toBeUndefined();
    expect(content.getObject(vAngleXId)).toBeUndefined();
    expect(content.getObject(vAngleYId)).toBeUndefined();

    // removing second point results in removal of polygon
    content.removeObjects(board, [px!.id]);
    expect(content.getObject(px!.id)).toBeUndefined();
    expect(content.getObject(poly!.id)).toBeUndefined();

    expect(content.applyChange(board, { operation: "create", target: "vertexAngle" })).toBeUndefined();
  });

  it("can add a vertex angle to a polygon from model objects", () => {
    let polygonId = "";
    let vAngle0Id = "";
    let vAngleXId = "";
    let vAngleYId = "";
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "p0", x: 0, y: 0 }));
      _content.addObjectModel(PointModel.create({ id: "px", x: 1, y: 0 }));
      _content.addObjectModel(PointModel.create({ id: "py", x: 0, y: 1 }));
      polygonId = _content.addObjectModel(PolygonModel.create({ points: ["p0", "px", "py"] }));
      vAngle0Id = _content.addObjectModel(VertexAngleModel.create({ points: ["px", "p0", "py"] }));
      vAngleXId = _content.addObjectModel(VertexAngleModel.create({ points: ["py", "px", "p0"] }));
      vAngleYId = _content.addObjectModel(VertexAngleModel.create({ points: ["p0", "py", "px"] }));
    });
    const p0: JXG.Point = board.objects.p0 as JXG.Point;
    const px: JXG.Point = board.objects.px as JXG.Point;
    const py: JXG.Point = board.objects.py as JXG.Point;
    const poly: JXG.Polygon = board.objects[polygonId] as JXG.Polygon;
    const pSolo: JXG.Point = content.addPoint(board, [9, 9])!;
    expect(canSupportVertexAngle(p0)).toBe(true);
    expect(canSupportVertexAngle(pSolo)).toBe(false);
    expect(getVertexAngle(p0)!.id).toBe(vAngle0Id);
    expect(getVertexAngle(px)!.id).toBe(vAngleXId);
    expect(getVertexAngle(py)!.id).toBe(vAngleYId);
    expect(getPointsForVertexAngle(pSolo)).toBeUndefined();
    expect(getPointsForVertexAngle(p0)!.map(p => p.id)).toEqual([px.id, p0.id, py.id]);
    expect(getPointsForVertexAngle(px)!.map(p => p.id)).toEqual([py.id, px.id, p0.id]);
    expect(getPointsForVertexAngle(py)!.map(p => p.id)).toEqual([p0.id, py.id, px.id]);
    p0.setPosition(JXG.COORDS_BY_USER, [1, 1]);
    updateVertexAnglesFromObjects([p0, px, py, poly]);
    expect(getPointsForVertexAngle(p0)!.map(p => p.id)).toEqual([py.id, p0.id, px.id]);

    expect(content.applyChange(board, { operation: "create", target: "vertexAngle" })).toBeUndefined();
  });

  it ("can add/remove movable line with comment", () => {
    const { content, board } = createContentAndBoard();
    content.addMovableLine(board, [[1, 1], [5, 5]], { id: "ml" });
    expect(content.lastObject).toEqual({
      id: "ml", type: "movableLine",
      colorScheme: 0,
      p1: { id: "ml-point1", type: "point", colorScheme: 0, x: 1, y: 1 },
      p2: { id: "ml-point2", type: "point", colorScheme: 0, x: 5, y: 5 } });
    const line = board.objects.ml as JXG.Line;
    expect(isMovableLine(line)).toBe(true);
    const [comment] = content.addComment(board, "ml")!;
    expect(content.lastObject).toEqual({ id: comment.id, type: "comment", anchors: ["ml"] });
    expect(isComment(comment)).toBe(true);

    // update comment text
    content.updateObjects(board, comment.id, { position: [5, 5], text: "new" });
    expect(content.lastObject).toEqual({ id: comment.id, type: "comment", anchors: ["ml"], x: 2, y: 2, text: "new" });

    // can access the movable line's points
    const p1 = content.getAnyObject("ml-point1");
    expect(p1).toEqual({
      id: "ml-point1",
      type: "point",
      colorScheme: 0,
      x: 1,
      y: 1
    });
    const p2 = content.getAnyObject("ml-point2");
    expect(p2).toEqual({
      id: "ml-point2",
      type: "point",
      colorScheme: 0,
      x: 5,
      y:5
    });

    // removing the line removes the line and its comment from the model and the board
    content.removeObjects(board, "ml");
    expect(board.objects.ml).toBeUndefined();
    expect(board.objects[comment.id]).toBeUndefined();
  });

  it ("can add/remove movable line with comment from model", () => {
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(MovableLineModel.create({ id: "ml", p1: { x: 1, y: 1 }, p2: { x: 5, y: 5 } }));
      _content.addObjectModel(CommentModel.create({ id: "c1", anchors: ["ml"] }));
    });
    const line = board.objects.ml as JXG.Line;
    const comment = board.objects.c1 as JXG.Text;
    expect(isMovableLine(line)).toBe(true);
    expect(isComment(comment)).toBe(true);
    content.removeObjects(board, "ml");
    expect(content.getObject("ml")).toBeUndefined();
    expect(content.getObject("c1")).toBeUndefined();
    expect(board.objects.ml).toBeUndefined();
    expect(board.objects.c1).toBeUndefined();
  });

  it("can copy selected objects", () => {
    const { content, board } = createContentAndBoard();
    const { points, polygon } = buildPolygon(board, content, [[0, 0], [1, 0], [0, 1]]);
    const [p0, px, py] = points;
    const polygonModel = content.getObject(polygon!.id) as PolygonModelType;
    expect(polygonModel?.type).toBe("polygon");

    // copies selected points
    content.selectObjects(board, p0.id);
    expect(content.getSelectedIds(board)).toEqual([p0.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds([PointModel.create(
        { id: p0.id, x: 0, y: 0, colorScheme: 0 })]);

    // copies comments along with selected points
    const [comment] = content.addComment(board, p0.id, "p0 comment") || [];
    expect(content.copySelection(board)).toEqualWithUniqueIds([
      PointModel.create({ id: p0.id, x: 0, y: 0, colorScheme: 0 }),
      CommentModel.create({ id: comment.id, anchors: [p0.id], text: "p0 comment"})
    ]);
    content.removeObjects(board, [comment.id]);

    // doesn't copy selected polygons if all vertices aren't selected
    // content.selectObjects(board, poly.id);
    expect(content.getSelectedIds(board)).toEqual([p0.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds([PointModel.create({ id: p0.id, x: 0, y: 0, colorScheme: 0 })]);

    // For comparison purposes, we need the polygon to be after the points in the array of objects
    const origObjects = Array.from(content.objects.values()).sort((a,b)=>a.type.localeCompare(b.type));

    // copies polygons if all vertices are selected
    content.selectObjects(board, [px.id, py.id]);
    expect(content.getSelectedIds(board)).toEqual([p0.id, px.id, py.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds(origObjects);

    // copies segment labels when copying polygons
    polygonModel?.setSegmentLabel([p0.id, px.id], ESegmentLabelOption.kLabel);
    content.selectObjects(board, [p0.id, px.id, py.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds(origObjects);

    content.removeObjects(board, polygon!.id);
    content.addVertexAngle(board, [py.id, p0.id, px.id]);

    // copies vertex angles if all vertices are selected
    content.selectObjects(board, [p0.id, px.id, py.id]);
    expect(content.getSelectedIds(board)).toEqual([p0.id, px.id, py.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds(Array.from(content.objects.values()));

    // copies movable lines
    content.deselectAll(board);
    content.addMovableLine(board, [[0, 0], [5, 5]], { id: "ml" });
    content.selectObjects(board, ["ml-point1", "ml-point2"]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds([content.lastObject]);
  });

  it("can duplicate selected objects", () => {
    const { content, board } = createContentAndBoard();
    const { points, polygon } = buildPolygon(board, content, [[0, 0], [1, 0], [0, 1]]);
    const [p0, px, py] = points;

    // copies selected points
    content.selectObjects(board, p0.id);
    expect(content.getSelectedIds(board)).toEqual([p0.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds([PointModel.create({ id: p0.id, x: 0, y: 0, colorScheme: 0 })]);

    // copies comments along with selected points
    const [comment] = content.addComment(board, p0.id, "p0 comment") || [];
    expect(content.copySelection(board)).toEqualWithUniqueIds([
      PointModel.create({ id: p0.id, x: 0, y: 0, colorScheme: 0 }),
      CommentModel.create({ id: comment.id, anchors: [p0.id], text: "p0 comment"})
    ]);
    content.removeObjects(board, [comment.id]);

    // doesn't copy selected polygons if all vertices aren't selected
    // content.selectObjects(board, poly.id);
    expect(content.getSelectedIds(board)).toEqual([p0.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds([PointModel.create({ id: p0.id, x: 0, y: 0, colorScheme: 0 })]);

    // For comparison purposes, we need the polygon to be after the points in the array of objects
    const origObjects = Array.from(content.objects.values()).sort((a,b)=>a.type.localeCompare(b.type));

    // copies polygons if all vertices are selected
    content.selectObjects(board, [px.id, py.id]);
    expect(content.getSelectedIds(board)).toEqual([p0.id, px.id, py.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds(origObjects);

    content.removeObjects(board, polygon!.id);
    content.addVertexAngle(board, [py.id, p0.id, px.id]);

    // copies vertex angles if all vertices are selected
    content.selectObjects(board, [p0.id, px.id, py.id]);
    expect(content.getSelectedIds(board)).toEqual([p0.id, px.id, py.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds(Array.from(content.objects.values()));

    // copies movable lines
    content.deselectAll(board);
    content.addMovableLine(board, [[0, 0], [5, 5]], { id: "ml" });
    content.selectObjects(board, ["ml-point1", "ml-point2"]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds([content.lastObject]);
  });

  it("can suspend/resume syncChanges", () => {
    const { content, board } = createContentAndBoard();
    expect(content.isSyncSuspended).toBe(false);
    content.suspendSync();
    expect(content.isSyncSuspended).toBe(true);
    content.suspendSync();
    expect(content.isSyncSuspended).toBe(true);
    content.addPoint(board, [1, 1], { id: "p1" });
    content.resumeSync();
    expect(content.isSyncSuspended).toBe(true);
    content.resumeSync();
    expect(content.isSyncSuspended).toBe(false);
    expect(content.batchChangeCount).toBe(0);
    expect(content.isUserResizable).toBe(true);
  });
});
