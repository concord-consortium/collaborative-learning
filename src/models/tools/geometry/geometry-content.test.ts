import { GeometryContentModel, GeometryContentModelType,
          kGeometryToolID, defaultGeometryContent } from "./geometry-content";
import { JXGChange } from "./jxg-changes";
import { isBoard } from "./jxg-board";
import { isPoint, isFreePoint } from "./jxg-point";
import { isPolygon } from "./jxg-polygon";
import { isUuid } from "../../../utilities/test-utils";
import { clone } from "lodash";

describe("GeometryContent", () => {

  it("can create with default properties", () => {
    const content = GeometryContentModel.create();
    expect(content.type).toBe(kGeometryToolID);
    expect(content.changes).toEqual([]);

    expect(content.nextViewId).toBe(1);
    expect(content.nextViewId).toBe(2);
  });

  function createDefaultBoard(content: GeometryContentModelType, readOnly: boolean = false): JXG.Board {
    const divId = "1234";
    const divStyle = "width:200px;height:200px";
    document.body.innerHTML = `<div id="${divId}" style="${divStyle}"></div>`;

    const elts = content.initializeBoard(divId, readOnly);
    return elts[0] as JXG.Board;
  }

  it("can create/destroy a JSXGraph board", () => {
    const content = defaultGeometryContent();
    expect(content.nextViewId).toBe(1);

    let board = createDefaultBoard(content);
    expect(isBoard(board)).toBe(true);
    expect(isUuid(board.id)).toBe(true);

    content.resizeBoard(board, 200, 200);

    content.destroyBoard(board);

    content.addChange({ operation: "create", target: "point", parents: [1, 1] });
    board = createDefaultBoard(content, true);
    expect(isBoard(board)).toBe(true);
    const boardId = board.id;

    const boundingBox = clone(board.boundingBox);
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

    const polygon = content.connectFreePoints(board);
    expect(polygon).toBeUndefined();

    // can delete board with change
    content.applyChange(board, { operation: "delete", target: "board", targetID: boardId });
  });

  it("can add/remove/update points", () => {
    const content = defaultGeometryContent();
    const board = createDefaultBoard(content);
    expect(isPoint(board)).toBe(false);
    const p1Id = "point-1";
    let p1: JXG.Point = board.objects[p1Id];
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
  });

  it("can add/remove/update polygons", () => {
    const content = defaultGeometryContent();
    content.addChange({ operation: "create", target: "point", parents: [1, 1], properties: { id: "p1" } });
    content.addChange({ operation: "create", target: "point", parents: [3, 3], properties: { id: "p2" } });
    content.addChange({ operation: "create", target: "point", parents: [5, 1], properties: { id: "p3" } });
    const board = createDefaultBoard(content);
    let polygon: JXG.Polygon | undefined = content.connectFreePoints(board) as JXG.Polygon;
    expect(isPolygon(polygon)).toBe(true);
    const polygonId = polygon.id;
    expect(isUuid(polygonId)).toBe(true);
    content.removeObjects(board, polygonId);
    expect(board.objects[polygonId]).toBeUndefined();
    // can't create polygon without vertices
    polygon = content.applyChange(board, { operation: "create", target: "polygon" }) as JXG.Polygon;
    expect(polygon).toBeUndefined();
  });
});
