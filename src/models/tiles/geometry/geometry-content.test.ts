import { resetMockUniqueId } from "../../document/document-content-tests/dc-test-utils";
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
import { ELabelOption, JXGChange, JXGCoordPair } from "./jxg-changes";
import { isPointInPolygon, getPointsForVertexAngle, getPolygonEdge } from "./jxg-polygon";
import { canSupportVertexAngle, getVertexAngle, updateVertexAnglesFromObjects } from "./jxg-vertex-angle";
import {
  isBoard, isCircle, isComment, isFreePoint, isImage, isLine, isMovableLine, isPoint, isPolygon,
  isText, kGeometryDefaultPixelsPerUnit, kGeometryDefaultXAxisMin, kGeometryDefaultYAxisMin
} from "./jxg-types";
import { TileModel, ITileModel } from "../tile-model";
import { getPoint, getPolygon } from "./geometry-utils";
import placeholderImage from "../../../assets/image_placeholder.png";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../../register-tile-types";
import { ITileExportOptions } from "../tile-content-info";
registerTileTypes(["Geometry"]);

// Need to mock this so the placeholder that is added to the cache
// has dimensions
jest.mock( "../../../utilities/image-utils", () => ({
  ...(jest.requireActual("../../../utilities/image-utils") as any),
  getImageDimensions: jest.fn(() =>
    Promise.resolve({ src: "test-file-stub", width: 200, height: 150 }))
}));

// mock Logger calls
const mockLogTileChangeEvent = jest.fn();
jest.mock("../log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent()
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
    const { point } = content.realizePhantomPoint(board, pair, "polygon");
    if (point) points.push(point);
  });
  const polygon = content.closeActivePolygon(board, points[finalVertexClicked]);
  assertIsDefined(polygon);
  return { polygon, points };
}

function exportAndSimplifyIds(content: GeometryContentModelType, options?: ITileExportOptions) {
  return content.exportJson(options)
    .replaceAll(/testid-[a-zA-Z0-9_-]+/g, "testid")
    .replaceAll(/jxgBoard[a-zA-Z0-9_-]+/g, "jxgid");
}

describe("GeometryContent", () => {

  beforeEach(() => {
    resetMockUniqueId();
  });

  const divId = "1234";
  const divStyle = "width:200px;height:200px";
  document.body.innerHTML = `<div id="${divId}" style="${divStyle}"></div>`;

  function createDefaultBoard(content: GeometryContentModelType): JXG.Board {
    function onCreate(elt: JXG.GeometryElement) {
      // handle a point
    }
    const board = content.initializeBoard(divId, false, onCreate, (b) => {}) as JXG.Board;
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
      {
        type: kGeometryTileType,
        board: defaultBoard(),
        objects: {},
        linkedAttributeColors: {},
        pointMetadata: {},
        isNavigatorVisible: true,
        navigatorPosition: "bottom",
        zoom: 1,
        offsetX: 0,
        offsetY: 0
    });

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
      linkedAttributeColors: {},
      pointMetadata: {},
      isNavigatorVisible: true,
      navigatorPosition: "bottom",
      zoom: 1,
      offsetX: 0,
      offsetY: 0
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

    content.rescaleBoard(board, params, true);
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
    expect(content.lastObject).toEqual({ id: p1Id, type: "point", x: 1, y: 1, colorScheme: 0,
      labelOption: "none", name: undefined, snapToGrid: undefined });
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
    expect(content.lastObject).toEqual({ id: p1Id, type: "point", x: 1, y: 1, colorScheme: 0,
      labelOption: "none", name: undefined, snapToGrid: undefined });

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
      id: polygon?.id, type: "polygon", points: [ points[0].id, points[1].id, points[2].id ],
      colorScheme: 0, labelOption: "none" });
    expect(isPolygon(polygon)).toBe(true);
    const polygonId = polygon?.id;
    expect(content.getDependents([points[0].id])).toEqual([points[0].id, polygonId]);
    expect(content.getDependents([points[0].id], { required: true })).toEqual([points[0].id]);
    expect(content.getDependents([points[2].id])).toEqual([points[2].id, polygonId]);
    expect(content.getDependents([points[2].id||''], { required: true })).toEqual([points[2].id]);

    expect(points.length).toEqual(3);
    expect(points[0].coords.usrCoords).toEqual([1, 1, 1]);
    expect(points[1].coords.usrCoords).toEqual([1, 3, 3]);
    expect(points[2].coords.usrCoords).toEqual([1, 5, 1]);

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

    content.realizePhantomPoint(board, [1, 1], "polygon");
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
      id: polygon?.id, type: "polygon", points: [ points[1].id, points[2].id, points[3].id ],
      colorScheme: 0, labelOption: "none" });
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

  it("does not crash when closing a minimal polygon", () => {
    // Regression test for CLUE-309: closing a polygon triggers updatePolygonVertices
    // which removes and recreates the polygon on the board. The board.suspendUpdate()
    // prevents JSXGraph from firing internal events (like Polygon.hasPoint) during
    // the transition between removal and recreation.
    const { content, board } = createContentAndBoard();
    const phantom = content.addPhantomPoint(board, [0, 0]);
    assertIsDefined(phantom);

    // Create a polygon with just 2 real points + phantom
    const { point: p1 } = content.realizePhantomPoint(board, [1, 1], "polygon");
    assertIsDefined(p1);
    const { point: p2 } = content.realizePhantomPoint(board, [3, 3], "polygon");
    assertIsDefined(p2);

    // Close the polygon by clicking the first point — this triggers
    // closeActivePolygon → syncChange → updatePolygonVertices
    const polygon = content.closeActivePolygon(board, p1);
    assertIsDefined(polygon);
    expect(isPolygon(polygon)).toBe(true);
    expect(polygon.vertices.map(v => v.id)).toEqual([p1.id, p2.id, p1.id]);

    destroyContentAndBoard(content, board);
  });

  it("handles appendPhantomPointToPolygon safely with vertex angles", () => {
    // Regression test for CLUE-309: appendPhantomPointToPolygon previously assumed
    // poly.vertices.length >= 3 without checking, and fixVertexAngle/getVertexAngle
    // did not handle undefined points. This test verifies the full flow of building
    // a polygon with vertex angles, re-activating it, and closing it — exercising
    // appendPhantomPointToPolygon and fixVertexAngle in the process.
    const { content, board } = createContentAndBoard();
    const { polygon, points } = buildPolygon(board, content, [[1, 1], [3, 3], [5, 1]]);
    assertIsDefined(polygon);

    // Add vertex angles to the polygon
    content.addVertexAngle(board, [points[2].id, points[0].id, points[1].id]);
    content.addVertexAngle(board, [points[0].id, points[1].id, points[2].id]);
    content.addVertexAngle(board, [points[1].id, points[2].id, points[0].id]);

    // Re-activate the polygon (calls appendPhantomPointToPolygon internally)
    content.addPhantomPoint(board, [0, 0]);
    const activePoly = content.makePolygonActive(board, polygon.id, points[1].id);
    assertIsDefined(activePoly);

    // The polygon should now have the phantom point inserted
    expect(activePoly.vertices.length).toBeGreaterThan(polygon.vertices.length);

    // Close the polygon (calls fixVertexAngle which calls getVertexAngle)
    const closedPoly = content.closeActivePolygon(board, getPoint(board, points[2].id)!);
    assertIsDefined(closedPoly);
    expect(isPolygon(closedPoly)).toBe(true);

    destroyContentAndBoard(content, board);
  });

  it("can create polygon from existing points", () => {
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "p1", x: 1, y: 1, colorScheme: 3 }));
      _content.addObjectModel(PointModel.create({ id: "p2", x: 3, y: 3, colorScheme: 2 }));
      _content.addObjectModel(PointModel.create({ id: "p3", x: 5, y: 1 }));
    });
    const phantom = content.addPhantomPoint(board, [0, 0]);

    let polygon = content.createPolygonIncludingPoint(board, "p1");
    assertIsDefined(polygon);
    expect(polygon.vertices.map(v => v.id)).toEqual(["p1", phantom?.id, "p1"]);
    const polyModel = content.getObject(polygon.id) as PolygonModelType;
    assertIsDefined(polyModel);
    expect(polyModel.points).toEqual(["p1"]);

    polygon = content.addPointToActivePolygon(board, "p2")!;
    expect(polygon.vertices.map(v => v.id)).toEqual(["p1", "p2", phantom?.id, "p1"]);
    expect(polyModel.points).toEqual(["p1", "p2"]);

    polygon = content.addPointToActivePolygon(board, "p3")!;
    expect(polygon.vertices.map(v => v.id)).toEqual(["p1", "p2", "p3", phantom?.id, "p1"]);
    expect(polyModel.points).toEqual(["p1", "p2", "p3"]);

    polygon = content.closeActivePolygon(board, getPoint(board, "p1")!)!;
    expect(polygon.vertices.map(v => v.id)).toEqual(["p1", "p2", "p3", "p1"]);
    expect(polyModel.points).toEqual(["p1", "p2", "p3"]);
    expect(polyModel.colorScheme).toEqual(3); // Starting point sets color
    destroyContentAndBoard(content, board);
  });

  it("can make two polygons that share a vertex", () => {
    const { content, board } = createContentAndBoard();
    // first polygon
    const { polygon, points } = buildPolygon(board, content, [[0, 0], [1, 1], [2, 2]]); // points 0, 1, 2
    // second polygon
    points.push(content.realizePhantomPoint(board, [5, 5], "polygon").point!); // point 3
    points.push(content.realizePhantomPoint(board, [4, 4], "polygon").point!); // point 4
    content.addPointToActivePolygon(board, points[2].id);
    const polygon2 = content.closeActivePolygon(board, points[3])!;
    expect(polygon?.vertices.map(v => v.id)).toEqual([points[0].id, points[1].id, points[2].id, points[0].id]);
    expect(polygon2.vertices.map(v => v.id)).toEqual([points[3].id, points[4].id, points[2].id, points[3].id]);

    expect(content.getDependents([points[2].id])).toEqual([points[2].id, polygon?.id, polygon2.id]);
    destroyContentAndBoard(content, board);
  });

  it("can extend a polygon with additional points", () => {
    const { content, board } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "extra1", x: 1, y: 1, colorScheme: 3 }));
    });
    const { polygon, points } = buildPolygon(board, content, [[1, 1], [3, 3], [7, 4]], 0);
    expect(polygon?.vertices.map(v => v.id)).toEqual([points[0].id, points[1].id, points[2].id, points[0].id]);
    expect(content.lastObjectOfType("polygon")).toEqual({
      id: polygon?.id, type: "polygon", points: [ points[0].id, points[1].id, points[2].id ],
      colorScheme: 0, labelOption: "none" });

    // Let's add some points between point[1] and points[2].
    let newPoly = content.makePolygonActive(board, polygon.id, points[1].id);
    expect(newPoly?.vertices.map(v => v.id)).toEqual(
      [points[2].id, points[0].id, points[1].id, content.phantomPoint?.id, points[2].id]);
    expect(content.lastObjectOfType("polygon")).toEqual({
      id: polygon?.id, type: "polygon", points: [ points[2].id, points[0].id, points[1].id ],
      colorScheme: 0, labelOption: "none" });

    // Add existing point
    newPoly = content.addPointToActivePolygon(board, "extra1");
    expect(newPoly?.vertices.map(v => v.id)).toEqual(
      [points[2].id, points[0].id, points[1].id, "extra1", content.phantomPoint?.id, points[2].id]);
    expect(content.lastObjectOfType("polygon")).toEqual({
      id: polygon?.id, type: "polygon",
      points: [ points[2].id, points[0].id, points[1].id, "extra1" ], colorScheme: 0, labelOption: "none" });

    // Add new point
    const result = content.realizePhantomPoint(board, [10, 10], "polygon");
    newPoly = result.polygon;
    const newPoint = result.point;
    expect(newPoly?.vertices.map(v => v.id)).toEqual(
      [points[2].id, points[0].id, points[1].id, "extra1", newPoint?.id, content.phantomPoint?.id, points[2].id]);
    expect(content.lastObjectOfType("polygon")).toEqual({
      id: polygon?.id, type: "polygon",
      points: [ points[2].id, points[0].id, points[1].id, "extra1", newPoint?.id ],
      colorScheme: 0, labelOption: "none" });

    newPoly = content.closeActivePolygon(board, points[2]);
    expect(newPoly?.vertices.map(v => v.id)).toEqual(
      [points[2].id, points[0].id, points[1].id, "extra1", newPoint?.id, points[2].id]);
    expect(content.lastObjectOfType("polygon")).toEqual({
      id: polygon?.id, type: "polygon",
      points: [ points[2].id, points[0].id, points[1].id, "extra1", newPoint?.id ],
      colorScheme: 0, labelOption: "none" });

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
      { id: comment.id, type: "comment", anchors: [polygon!.id], x: 4, y: 4, text: "new" });

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
        labels: [{ id: segmentIdFromPointIds(["p1", "p2"]), option: ELabelOption.kLength }]
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
    content.updatePolygonSegmentLabel(board, polygon, [p1, p2], ELabelOption.kLabel, "seg1");
    expect(content.getObject(polygon.id)).toEqual({
      id: polygonId,
      type: "polygon",
      points: ["p1", "p2", "p3"],
      colorScheme: 0,
      labelOption: "none",
      labels: [{ id: segmentIdFromPointIds(["p1", "p2"]), option: ELabelOption.kLabel, name: "seg1" }]
    });
    content.updatePolygonSegmentLabel(board, polygon, [p2, p3], ELabelOption.kLength, "seg2");
    expect(content.getObject(polygon.id)).toEqual({
      id: polygonId,
      type: "polygon",
      points: ["p1", "p2", "p3"],
      colorScheme: 0,
      labelOption: "none",
      labels: [{ id: segmentIdFromPointIds(["p1", "p2"]), option: ELabelOption.kLabel, name: "seg1" },
               { id: segmentIdFromPointIds(["p2", "p3"]), option: ELabelOption.kLength, name: "seg2" }]
    });
    content.updatePolygonSegmentLabel(board, polygon, [p1, p2], ELabelOption.kNone, undefined);
    expect(content.getObject(polygon.id)).toEqual({
      id: polygonId,
      type: "polygon",
      colorScheme: 0,
      labelOption: "none",
      points: ["p1", "p2", "p3"],
      labels: [{ id: segmentIdFromPointIds(["p2", "p3"]), option: ELabelOption.kLength, name: "seg2" }]
    });

    content.removeObjects(board, polygonId);
    expect(board.objects[polygonId]).toBeUndefined();

    destroyContentAndBoard(content, board);
  });

  it("can add and remove a circle", () => {
    const { content, board } = createContentAndBoard();
    content.addPhantomPoint(board, [0, 0]);
    const { point: point1 } = content.realizePhantomPoint(board, [0, 0], "circle");
    const { point: point2, circle } = content.realizePhantomPoint(board, [1, 0], "circle");
    expect(isPoint(point1)).toBeTruthy();
    expect(isPoint(point2)).toBeTruthy();
    expect(isCircle(circle)).toBeTruthy();
    expect(board.objectsList.filter(o => isCircle(o)).length).toBe(1);
    expect(content.getDependents([point1!.id])).toEqual([point1!.id, circle!.id]);
    expect(content.getDependents([point2!.id])).toEqual([point2!.id, circle!.id]);
    expect(content.getDependents([circle!.id])).toEqual([circle!.id]);
    expect(content.lastObjectOfType("circle")).toEqual({
      id: circle?.id,
      type: "circle",
      centerPoint: point1?.id,
      tangentPoint: point2?.id,
      colorScheme: 0 });

    // Removing point should remove circle
    content.removeObjects(board, [point1!.id]);
    expect(board.objectsList.filter(o => isCircle(o)).length).toBe(0);
    destroyContentAndBoard(content, board);
  });

  it ("will create a point, circle, or polygon with the correct selected color or default color", () => {
    const { content, board } = createContentAndBoard();

    // create a point with default color
    content.addPhantomPoint(board, [0, 0]);
    const {point: point0} = content.realizePhantomPoint(board, [0, 0], "points");
    expect(point0?.getAttribute("colorScheme")).toBe(0);

    // create a point
    content.setSelectedColor(1);
    content.addPhantomPoint(board, [1, 1]);
    const { point: point1 } = content.realizePhantomPoint(board, [1, 1], "points");
    expect(point1?.getAttribute("colorScheme")).toBe(1);

    // create a circle
    content.setSelectedColor(2);
    content.addPhantomPoint(board, [0, 0]);
    content.realizePhantomPoint(board, [0, 0], "circle");
    const { circle } = content.realizePhantomPoint(board, [1, 0], "circle");
    expect(circle?.getAttribute("colorScheme")).toBe(2);

    // create a polygon
    content.setSelectedColor(3);
    const { polygon } = buildPolygon(board, content, [[0, 0], [1, 1], [1, 0]]);
    expect(polygon?.getAttribute("colorScheme")).toBe(3);

    destroyContentAndBoard(content, board);
  });

  it ("can change the color of a selected polygon, circle, or point", () => {
    const { content, board } = createContentAndBoard();

    // // change color of polygon
    const { polygon } = buildPolygon(board, content, [[0, 0], [1, 1], [1, 0]]);
    content.selectObjects(board, polygon.id);
    content.setSelectedColor(1);
    content.updateSelectedObjectsColor(board, 1);
    expect(polygon.getAttribute("colorScheme")).toBe(1);
    content.removeObjects(board, polygon.id);

    // reset color
    content.setSelectedColor(0);
    // change color of circle
    content.addPhantomPoint(board, [0, 0]);
    content.realizePhantomPoint(board, [0, 0], "circle");
    const { circle } = content.realizePhantomPoint(board, [1, 0], "circle");
    content.selectObjects(board, circle!.id);
    content.setSelectedColor(2);
    content.updateSelectedObjectsColor(board, 2);
    expect(circle!.getAttribute("colorScheme")).toBe(2);
    content.removeObjects(board, circle!.id);

    // reset color
    content.setSelectedColor(0);
    // change color of a point
    const point = content.addPhantomPoint(board, [0, 0]);
    content.realizePhantomPoint(board, [0, 0], "points");
    content.selectObjects(board, point!.id);
    content.setSelectedColor(3);
    content.updateSelectedObjectsColor(board, 3);
    expect(point!.getAttribute("colorScheme")).toBe(3);

    destroyContentAndBoard(content, board);
  });

  it("can add a circle from existing points", () => {
    const { content, board } = createContentAndBoard();
    content.addPhantomPoint(board, [0, 0]);
    const { point: point1 } = content.realizePhantomPoint(board, [1, 1], "points");
    const { point: point2 } = content.realizePhantomPoint(board, [2, 2], "points");
    expect(board.objectsList.filter(o => isCircle(o)).length).toBe(0);
    content.createCircleIncludingPoint(board, point1!.id);
    const circle = content.closeActiveCircle(board, point2!);
    expect(isCircle(circle)).toBeTruthy();
    expect(circle?.center.X()).toBe(1);
    expect(circle?.center.Y()).toBe(1);
    expect(board.objectsList.filter(o => isCircle(o)).length).toBe(1);
    content.removeObjects(board, [circle!.id]);
    expect(board.objectsList.filter(o => isCircle(o)).length).toBe(0);
    // points should remain when circle removed
    expect(isPoint(board.objects[point1!.id])).toBeTruthy();
    expect(isPoint(board.objects[point2!.id])).toBeTruthy();
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
      { id: polygon?.id, type: "polygon", colorScheme: 0, points: [p1!.id, p2!.id, p3!.id],
        labelOption: "none"
       });
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
      { id: polygon?.id, type: "polygon", colorScheme: 0, points: [p0!.id, px!.id, py!.id],
        labelOption: "none"
       });
    const pSolo: JXG.Point = content.addPoint(board, [9, 9])!;
    expect(canSupportVertexAngle(p0)).toBe(true);
    expect(canSupportVertexAngle(pSolo)).toBe(false);
    expect(getVertexAngle(p0)).toBeUndefined();
    // getVertexAngle should handle undefined input without throwing
    expect(getVertexAngle(undefined)).toBeUndefined();
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
      { id: polygon?.id, type: "polygon", colorScheme: 0, points: [px!.id, py!.id], labelOption: "none" });
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
      { id: poly?.id, type: "polygon", colorScheme: 0, points: [px!.id, py!.id],
        labelOption: "none"
       });
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
      p1: { id: "ml-point1", type: "point", colorScheme: 0, x: 1, y: 1,
        labelOption: "none", name: undefined, snapToGrid: undefined },
      p2: { id: "ml-point2", type: "point", colorScheme: 0, x: 5, y: 5,
        labelOption: "none", name: undefined, snapToGrid: undefined }
    });
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
      y: 1,
      labelOption: "none",
      name: undefined,
      snapToGrid: undefined
    });
    const p2 = content.getAnyObject("ml-point2");
    expect(p2).toEqual({
      id: "ml-point2",
      type: "point",
      colorScheme: 0,
      x: 5,
      y:5,
      labelOption: "none",
      name: undefined,
      snapToGrid: undefined
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
        { id: p0.id, x: 0, y: 0, snapToGrid:true, colorScheme: 0 })]);

    // copies comments along with selected points
    const [comment] = content.addComment(board, p0.id, "p0 comment") || [];
    expect(content.copySelection(board)).toEqualWithUniqueIds([
      PointModel.create({ id: p0.id, x: 0, y: 0,  snapToGrid: true, colorScheme: 0 }),
      CommentModel.create({ id: comment.id, anchors: [p0.id], text: "p0 comment"})
    ]);
    content.removeObjects(board, [comment.id]);

    // doesn't copy selected polygons if all vertices aren't selected
    // content.selectObjects(board, poly.id);
    expect(content.getSelectedIds(board)).toEqual([p0.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds([PointModel.create({ id: p0.id, x: 0, y: 0, snapToGrid: true, colorScheme: 0 })]);

    // For comparison purposes, we need the polygon to be after the points in the array of objects
    const origObjects = Array.from(content.objects.values()).sort((a,b)=>a.type.localeCompare(b.type));

    // copies polygons if all vertices are selected
    content.selectObjects(board, [px.id, py.id]);
    expect(content.getSelectedIds(board)).toEqual([p0.id, px.id, py.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds(origObjects);

    // copies segment labels when copying polygons
    polygonModel?.setSegmentLabel([p0.id, px.id], ELabelOption.kLabel, "name1");
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
      .toEqualWithUniqueIds([PointModel.create({ id: p0.id, x: 0, y: 0, snapToGrid: true, colorScheme: 0 })]);

    // copies comments along with selected points
    const [comment] = content.addComment(board, p0.id, "p0 comment") || [];
    expect(content.copySelection(board)).toEqualWithUniqueIds([
      PointModel.create({ id: p0.id, x: 0, y: 0,  snapToGrid: true, colorScheme: 0 }),
      CommentModel.create({ id: comment.id, anchors: [p0.id], text: "p0 comment"})
    ]);
    content.removeObjects(board, [comment.id]);

    // doesn't copy selected polygons if all vertices aren't selected
    // content.selectObjects(board, poly.id);
    expect(content.getSelectedIds(board)).toEqual([p0.id]);
    expect(content.copySelection(board))
      .toEqualWithUniqueIds([PointModel.create({ id: p0.id, x: 0, y: 0, snapToGrid: true, colorScheme: 0 })]);

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

  /* eslint-disable max-len */
  it("exports basic content properly", () => {
    const { content } = createContentAndBoard((_content) => {
      _content.addObjectModel(PointModel.create({ id: "p1", x: 1, y: 1 }));
      _content.addObjectModel(PointModel.create({ id: "p2", x: 3, y: 3, colorScheme: 1, snapToGrid: false }));
      _content.addObjectModel(PointModel.create({ id: "p3", x: 5, y: 1, name: "A", labelOption: "label" }));
    });

    expect(exportAndSimplifyIds(content)).toMatchInlineSnapshot(`
"{
  \\"type\\": \\"Geometry\\",
  \\"isNavigatorVisible\\": true,
  \\"navigatorPosition\\": \\"bottom\\",
  \\"offsetX\\": 0,
  \\"offsetY\\": 0,
  \\"zoom\\": 1,
  \\"board\\": {\\"xAxis\\": {\\"name\\": \\"x\\", \\"label\\": \\"x\\", \\"min\\": -2, \\"unit\\": 18.3, \\"range\\": 26.229508196721312}, \\"yAxis\\": {\\"name\\": \\"y\\", \\"label\\": \\"y\\", \\"min\\": -1, \\"unit\\": 18.3, \\"range\\": 17.486338797814206}},
  \\"objects\\": {
    \\"p1\\": {\\"type\\": \\"point\\", \\"id\\": \\"p1\\", \\"x\\": 1, \\"y\\": 1, \\"colorScheme\\": 0, \\"labelOption\\": \\"none\\"},
    \\"p2\\": {\\"type\\": \\"point\\", \\"id\\": \\"p2\\", \\"x\\": 3, \\"y\\": 3, \\"snapToGrid\\": false, \\"colorScheme\\": 1, \\"labelOption\\": \\"none\\"},
    \\"p3\\": {\\"type\\": \\"point\\", \\"id\\": \\"p3\\", \\"x\\": 5, \\"y\\": 1, \\"name\\": \\"A\\", \\"colorScheme\\": 0, \\"labelOption\\": \\"label\\"}
  },
  \\"pointMetadata\\": {},
  \\"linkedAttributeColors\\": {}
}"
`);
  });

  it("exports polygons and vertexangles correctly", () => {
    const { content, board } = createContentAndBoard();
    const { points } = buildPolygon(board, content, [[0, 0], [1, 0], [0, 1]]);
    content.addVertexAngle(board, [points[0].id, points[1].id, points[2].id]);
    expect(exportAndSimplifyIds(content)).
toMatchInlineSnapshot(`
"{
  \\"type\\": \\"Geometry\\",
  \\"isNavigatorVisible\\": true,
  \\"navigatorPosition\\": \\"bottom\\",
  \\"offsetX\\": 0,
  \\"offsetY\\": 0,
  \\"zoom\\": 1,
  \\"board\\": {\\"xAxis\\": {\\"name\\": \\"x\\", \\"label\\": \\"x\\", \\"min\\": -2, \\"unit\\": 18.3, \\"range\\": 26.229508196721312}, \\"yAxis\\": {\\"name\\": \\"y\\", \\"label\\": \\"y\\", \\"min\\": -1, \\"unit\\": 18.3, \\"range\\": 17.486338797814206}},
  \\"objects\\": {
    \\"testid\\": {\\"type\\": \\"point\\", \\"id\\": \\"testid\\", \\"x\\": 0, \\"y\\": 0, \\"snapToGrid\\": true, \\"colorScheme\\": 0, \\"labelOption\\": \\"none\\"},
    \\"jxgid\\": {\\"type\\": \\"polygon\\", \\"id\\": \\"jxgid\\", \\"points\\": [\\"testid\\", \\"testid\\", \\"testid\\"], \\"labelOption\\": \\"none\\", \\"colorScheme\\": 0},
    \\"testid\\": {\\"type\\": \\"point\\", \\"id\\": \\"testid\\", \\"x\\": 1, \\"y\\": 0, \\"snapToGrid\\": true, \\"colorScheme\\": 0, \\"labelOption\\": \\"none\\"},
    \\"testid\\": {\\"type\\": \\"point\\", \\"id\\": \\"testid\\", \\"x\\": 0, \\"y\\": 1, \\"snapToGrid\\": true, \\"colorScheme\\": 0, \\"labelOption\\": \\"none\\"},
    \\"testid\\": {\\"type\\": \\"vertexAngle\\", \\"id\\": \\"testid\\", \\"points\\": [\\"testid\\", \\"testid\\", \\"testid\\"]}
  },
  \\"pointMetadata\\": {},
  \\"linkedAttributeColors\\": {}
}"
`);
  });

  it("exports movable lines and comments correctly", () => {
    const { content, board } = createContentAndBoard();
    content.addMovableLine(board, [[1, 1], [5, 5]], { id: "ml" });
    const line = board.objects.ml as JXG.Line;
    expect(isMovableLine(line)).toBe(true);
    content.addComment(board, "ml")!;

    expect(exportAndSimplifyIds(content)).
toMatchInlineSnapshot(`
"{
  \\"type\\": \\"Geometry\\",
  \\"isNavigatorVisible\\": true,
  \\"navigatorPosition\\": \\"bottom\\",
  \\"offsetX\\": 0,
  \\"offsetY\\": 0,
  \\"zoom\\": 1,
  \\"board\\": {\\"xAxis\\": {\\"name\\": \\"x\\", \\"label\\": \\"x\\", \\"min\\": -2, \\"unit\\": 18.3, \\"range\\": 26.229508196721312}, \\"yAxis\\": {\\"name\\": \\"y\\", \\"label\\": \\"y\\", \\"min\\": -1, \\"unit\\": 18.3, \\"range\\": 17.486338797814206}},
  \\"objects\\": {
    \\"ml\\": {
      \\"type\\": \\"movableLine\\",
      \\"id\\": \\"ml\\",
      \\"p1\\": {\\"type\\": \\"point\\", \\"id\\": \\"ml-point1\\", \\"x\\": 1, \\"y\\": 1, \\"colorScheme\\": 0, \\"labelOption\\": \\"none\\"},
      \\"p2\\": {\\"type\\": \\"point\\", \\"id\\": \\"ml-point2\\", \\"x\\": 5, \\"y\\": 5, \\"colorScheme\\": 0, \\"labelOption\\": \\"none\\"},
      \\"colorScheme\\": 0
    },
    \\"testid\\": {\\"type\\": \\"comment\\", \\"id\\": \\"testid\\", \\"anchors\\": [\\"ml\\"]}
  },
  \\"pointMetadata\\": {},
  \\"linkedAttributeColors\\": {}
}"
`);
  });

  it("exports background image correctly", () => {
    const { content } = createContentAndBoard((_content) => {
      _content.setBackgroundImage(
        ImageModel.create({ id: "img", url: placeholderImage, x: 0, y: 0, width: 5, height: 5 }));
    });

    expect(exportAndSimplifyIds(content)).toMatchInlineSnapshot(`
"{
  \\"type\\": \\"Geometry\\",
  \\"isNavigatorVisible\\": true,
  \\"navigatorPosition\\": \\"bottom\\",
  \\"offsetX\\": 0,
  \\"offsetY\\": 0,
  \\"zoom\\": 1,
  \\"board\\": {\\"xAxis\\": {\\"name\\": \\"x\\", \\"label\\": \\"x\\", \\"min\\": -2, \\"unit\\": 18.3, \\"range\\": 26.229508196721312}, \\"yAxis\\": {\\"name\\": \\"y\\", \\"label\\": \\"y\\", \\"min\\": -1, \\"unit\\": 18.3, \\"range\\": 17.486338797814206}},
  \\"bgImage\\": {\\"type\\": \\"image\\", \\"id\\": \\"img\\", \\"x\\": 0, \\"y\\": 0, \\"url\\": \\"test-file-stub\\", \\"width\\": 5, \\"height\\": 5},
  \\"objects\\": {},
  \\"pointMetadata\\": {},
  \\"linkedAttributeColors\\": {}
}"
`);
  });

  it("exports only the objects and background image for hashing", () => {
    const { content, board } = createContentAndBoard((_content) => {
      _content.setBackgroundImage(
        ImageModel.create({ id: "img", url: placeholderImage, x: 0, y: 0, width: 5, height: 5 }));
    });
    content.addMovableLine(board, [[1, 1], [5, 5]], { id: "ml" });
    const line = board.objects.ml as JXG.Line;
    expect(isMovableLine(line)).toBe(true);
    content.addComment(board, "ml")!;

    expect(exportAndSimplifyIds(content, {forHash: true})).toMatchInlineSnapshot(`
"{
  \\"objects\\": {
    \\"ml\\": {
      \\"type\\": \\"movableLine\\",
      \\"id\\": \\"ml\\",
      \\"p1\\": {\\"type\\": \\"point\\", \\"id\\": \\"ml-point1\\", \\"x\\": 1, \\"y\\": 1, \\"colorScheme\\": 0, \\"labelOption\\": \\"none\\"},
      \\"p2\\": {\\"type\\": \\"point\\", \\"id\\": \\"ml-point2\\", \\"x\\": 5, \\"y\\": 5, \\"colorScheme\\": 0, \\"labelOption\\": \\"none\\"},
      \\"colorScheme\\": 0
    },
    \\"testid\\": {\\"type\\": \\"comment\\", \\"id\\": \\"testid\\", \\"anchors\\": [\\"ml\\"]}
  },
  \\"bgImage\\": {\\"type\\": \\"image\\", \\"id\\": \\"img\\", \\"x\\": 0, \\"y\\": 0, \\"url\\": \\"test-file-stub\\", \\"width\\": 5, \\"height\\": 5}
}"
`);
  });


});
/* eslint-enable max-len */
