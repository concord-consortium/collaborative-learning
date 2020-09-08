import { GeometryContentModel, GeometryContentModelType,
          kGeometryToolID, defaultGeometryContent, GeometryMetadataModel } from "./geometry-content";
import { JXGChange } from "./jxg-changes";
import { isBoard } from "./jxg-board";
import { isPoint, isFreePoint } from "./jxg-point";
import { isPointInPolygon, isPolygon, getPointsForVertexAngle } from "./jxg-polygon";
import { canSupportVertexAngle, getVertexAngle, updateVertexAnglesFromObjects } from "./jxg-vertex-angle";
import { isUuid } from "../../../utilities/test-utils";
import { clone } from "lodash";
import { destroy } from "mobx-state-tree";

import placeholderImage from "../../../assets/image_placeholder.png";

describe("GeometryContent", () => {

  const divId = "1234";
  const divStyle = "width:200px;height:200px";
  document.body.innerHTML = `<div id="${divId}" style="${divStyle}"></div>`;

  function createDefaultBoard(content: GeometryContentModelType): JXG.Board {
    function onCreate(elt: JXG.GeometryElement) {
      // handle a point
    }
    const board = content.initializeBoard(divId, onCreate) as JXG.Board;
    content.resizeBoard(board, 200, 200);
    content.updateScale(board, 0.5);
    return board;
  }

  function createContentAndBoard(
              configContent?: (content: GeometryContentModelType) => void):
              { content: GeometryContentModelType, board: JXG.Board } {
    const content = defaultGeometryContent();
    const metadata = GeometryMetadataModel.create({ id: "geometry-1" });
    content.doPostCreate(metadata);
    if (configContent) configContent(content);
    const board = createDefaultBoard(content);
    return { content, board };
  }

  function destroyContentAndBoard(content: GeometryContentModelType, board?: JXG.Board) {
    if (board) content.destroyBoard(board);
    destroy(content);
  }

  it("can create with default properties", () => {
    const content = GeometryContentModel.create();
    expect(content.type).toBe(kGeometryToolID);
    expect(content.changes).toEqual([]);

    destroy(content);
  });

  it("can create with authored properties", () => {
    const authored = {
            board: {
              properties: {
                axisNames: ["authorX", "authorY"]
              }
            },
            objects: []
          };
    const content = GeometryContentModel.create(authored);
    expect(content.type).toBe(kGeometryToolID);
    expect(content.changes.length).toEqual(1);
    const change = JSON.parse(content.changes[0]);
    expect(change.properties.xName).toBe("authorX");
    expect(change.properties.yName).toBe("authorY");

    destroy(content);
  });

  it("can create/destroy a JSXGraph board", () => {
    const { content, board } = createContentAndBoard(_content => {
      _content.addChange({ operation: "create", target: "point", parents: [1, 1] });
    });
    expect(isBoard(board)).toBe(true);

    content.resizeBoard(board, 200, 200);
    content.updateScale(board, 0.5);
    expect(board.cssTransMat).toEqual([[1, 0, 0], [0, 2, 0], [0, 0, 2]]);

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

    const polygon = content.createPolygonFromFreePoints(board);
    expect(polygon).toBeUndefined();

    // can delete board with change
    content.applyChange(board, { operation: "delete", target: "board", targetID: boardId });

    destroyContentAndBoard(content);
  });

  it("can add/remove/update points", () => {
    const { content, board } = createContentAndBoard();
    expect(isPoint(board)).toBe(false);
    const p1Id = "point-1";
    let p1: JXG.Point = board.objects[p1Id] as JXG.Point;
    expect(p1).toBeUndefined();
    p1 = content.addPoint(board, [1, 1], { id: p1Id }) as JXG.Point;
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
    content.removeObjects(board, p1Id);
    expect(board.objects[p1Id]).toBeUndefined();
    const p3: JXG.Point = content.addPoint(board, [2, 2]) as JXG.Point;
    expect(isUuid(p3.id)).toBe(true);
    // requests to remove points with invalid IDs are ignored
    content.removeObjects(board, ["foo"]);
    content.applyChange(board, { operation: "delete", target: "point" });

    destroyContentAndBoard(content, board);
  });

  it("can add/remove/update polygons", () => {
    const { content, board } = createContentAndBoard((_content) => {
      _content.addChange({ operation: "create", target: "point", parents: [1, 1], properties: { id: "p1" } });
      _content.addChange({ operation: "create", target: "point", parents: [3, 3], properties: { id: "p2" } });
      _content.addChange({ operation: "create", target: "point", parents: [5, 1], properties: { id: "p3" } });
    });
    let polygon: JXG.Polygon | undefined = content.createPolygonFromFreePoints(board) as JXG.Polygon;
    expect(isPolygon(polygon)).toBe(true);
    const polygonId = polygon.id;
    expect(isUuid(polygonId)).toBe(true);

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

  it("can add an image", () => {
    const { content, board } = createContentAndBoard();
    const image = content.addImage(board, placeholderImage, [0, 0], [5, 5]);
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

  it("can select points, etc.", () => {
    const { content, board } = createContentAndBoard();
    const p1 = content.addPoint(board, [0, 0]);
    const p2 = content.addPoint(board, [1, 1]);
    const p3 = content.addPoint(board, [1, 0]);
    const poly = content.createPolygonFromFreePoints(board);
    content.selectObjects(board, p1!.id);
    expect(content.isSelected(p1!.id)).toBe(true);
    expect(content.isSelected(p2!.id)).toBe(false);
    expect(content.isSelected(p3!.id)).toBe(false);
    content.selectObjects(board, poly!.id);
    expect(content.isSelected(poly!.id)).toBe(true);
    expect(content.hasSelection()).toBe(true);
    let found = content.findObjects(board, (obj: JXG.GeometryElement) => {
                  return obj.id === p1!.id;
                });
    expect(found.length).toBe(1);
    content.deselectObjects(board, p1!.id);
    expect(content.isSelected(p1!.id)).toBe(false);
    content.deselectAll(board);
    expect(content.hasSelection()).toBe(false);
    content.selectObjects(board, p1!.id);
    content.deleteSelection(board);
    expect(content.hasSelection()).toBe(false);
    found = content.findObjects(board, (obj: JXG.GeometryElement) => {
              return obj.id === p1!.id;
            });
    expect(found.length).toBe(0);
    content.deleteSelection(board);
    expect(found.length).toBe(0);
  });

  it("can add a vertex angle to a polygon", () => {
    const { content, board } = createContentAndBoard();
    const p0: JXG.Point = content.addPoint(board, [0, 0])!;
    const px: JXG.Point = content.addPoint(board, [1, 0])!;
    const py: JXG.Point = content.addPoint(board, [0, 1])!;
    const poly: JXG.Polygon = content.createPolygonFromFreePoints(board)!;
    const pSolo: JXG.Point = content.addPoint(board, [9, 9])!;
    expect(canSupportVertexAngle(p0)).toBe(true);
    expect(canSupportVertexAngle(pSolo)).toBe(false);
    expect(getVertexAngle(p0)).toBeUndefined();
    const va0 = content.addVertexAngle(board, [px.id, p0.id, py.id]);
    const vax = content.addVertexAngle(board, [py.id, px.id, p0.id]);
    const vay = content.addVertexAngle(board, [p0.id, py.id, px.id]);
    expect(getVertexAngle(p0)!.id).toBe(va0!.id);
    expect(getVertexAngle(px)!.id).toBe(vax!.id);
    expect(getVertexAngle(py)!.id).toBe(vay!.id);
    expect(getPointsForVertexAngle(pSolo)).toBeUndefined();
    expect(getPointsForVertexAngle(p0)!.map(p => p.id)).toEqual([px.id, p0.id, py.id]);
    expect(getPointsForVertexAngle(px)!.map(p => p.id)).toEqual([py.id, px.id, p0.id]);
    expect(getPointsForVertexAngle(py)!.map(p => p.id)).toEqual([p0.id, py.id, px.id]);
    p0.setPosition(JXG.COORDS_BY_USER, [1, 1]);
    updateVertexAnglesFromObjects([p0, px, py, poly]);
    expect(getPointsForVertexAngle(p0)!.map(p => p.id)).toEqual([py.id, p0.id, px.id]);

    expect(content.applyChange(board, { operation: "create", target: "vertexAngle" })).toBeUndefined();
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

  it("can pop a single change", () => {
    const change1 = { operation: "create", target: "foo" } as any as JXGChange;
    const change2 = { operation: "create", target: "bar" } as any as JXGChange;

    const { content, board } = createContentAndBoard();
    content.applyChange(board, change1);
    content.applyChange(board, change2);
    expect(content.changes.length).toBe(3);
    const change = content.popChangeset();
    expect(change && change.map((changeStr: any) => JSON.parse(changeStr))).toEqual([change2]);
    expect(content.changes.length).toBe(2);
    expect(JSON.parse(content.changes[1])).toEqual(change1);
  });

  it("can pop a batch of change", () => {
    const change1 = { operation: "create", target: "foo" } as any as JXGChange;
    const change2 = { operation: "create", target: "bar", startBatch: true } as any as JXGChange;
    const change3 = { operation: "create", target: "baz" } as any as JXGChange;
    const change4 = { operation: "create", target: "qux", endBatch: true } as any as JXGChange;

    const { content, board } = createContentAndBoard();
    content.applyChange(board, change1);
    content.applyChange(board, change2);
    content.applyChange(board, change3);
    content.applyChange(board, change4);
    expect(content.changes.length).toBe(5);
    const change = content.popChangeset();
    expect(change && change.map((changeStr: any) => JSON.parse(changeStr))).toEqual([change2, change3, change4]);
    expect(content.changes.length).toBe(2);
    expect(JSON.parse(content.changes[1])).toEqual(change1);
  });
});
