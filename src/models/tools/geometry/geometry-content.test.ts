import { GeometryContentModel, GeometryContentModelType,
          kGeometryToolID, defaultGeometryContent, GeometryMetadataModel } from "./geometry-content";
import { JXGChange } from "./jxg-changes";
import { isBoard } from "./jxg-board";
import { isPoint, isFreePoint } from "./jxg-point";
import { isPolygon } from "./jxg-polygon";
import { isUuid } from "../../../utilities/test-utils";
import { clone } from "lodash";

const placeholderImage = require("../../../assets/image_placeholder.png");

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

    function onCreate(elt: JXG.GeometryElement) {
      // handle a point
    }

    return content.initializeBoard(divId, onCreate) as JXG.Board;
  }

  it("can create/destroy a JSXGraph board", () => {
    const content = defaultGeometryContent();
    expect(content.nextViewId).toBe(1);

    let board = createDefaultBoard(content);
    expect(isBoard(board)).toBe(true);
    expect(isUuid(board.id)).toBe(true);

    content.resizeBoard(board, 200, 200);
    content.updateScale(board, 0.5);
    expect(board.cssTransMat).toEqual([[1, 0, 0], [0, 2, 0], [0, 0, 2]]);

    content.destroyBoard(board);

    content.addChange({ operation: "create", target: "point", parents: [1, 1] });
    board = createDefaultBoard(content, true);
    expect(isBoard(board)).toBe(true);
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
  });

  it("can add/remove/update points", () => {
    const content = defaultGeometryContent();
    const board = createDefaultBoard(content);
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
  });

  it("can add/remove/update polygons", () => {
    const content = defaultGeometryContent();
    content.addChange({ operation: "create", target: "point", parents: [1, 1], properties: { id: "p1" } });
    content.addChange({ operation: "create", target: "point", parents: [3, 3], properties: { id: "p2" } });
    content.addChange({ operation: "create", target: "point", parents: [5, 1], properties: { id: "p3" } });
    const board = createDefaultBoard(content);
    let polygon: JXG.Polygon | undefined = content.createPolygonFromFreePoints(board) as JXG.Polygon;
    expect(isPolygon(polygon)).toBe(true);
    const polygonId = polygon.id;
    expect(isUuid(polygonId)).toBe(true);
    content.removeObjects(board, polygonId);
    expect(board.objects[polygonId]).toBeUndefined();
    // can't create polygon without vertices
    polygon = content.applyChange(board, { operation: "create", target: "polygon" }) as JXG.Polygon;
    expect(polygon).toBeUndefined();
  });

  it("can add an image", () => {
    const content = defaultGeometryContent();
    const board = createDefaultBoard(content);
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
  });

  it("can select points, etc.", () => {
    const content = defaultGeometryContent();
    const metadata = GeometryMetadataModel.create({ id: "geometry-1" });
    content.doPostCreate(metadata);
    const board = createDefaultBoard(content);
    const p1 = content.addPoint(board, [0, 0]);
    const p2 = content.addPoint(board, [1, 1]);
    const p3 = content.addPoint(board, [1, 0]);
    const poly = content.createPolygonFromFreePoints(board);
    content.selectObjects(board, p1!.id);
    expect(content.isSelected(p1!.id)).toBe(true);
    expect(content.isSelected(p2!.id)).toBe(false);
    content.selectObjects(board, poly!.id);
    expect(content.isSelected(poly!.id)).toBe(true);
    expect(content.hasSelection()).toBe(true);
    let found = content.findObjects(board, obj => {
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
    found = content.findObjects(board, obj => {
              return obj.id === p1!.id;
            });
    expect(found.length).toBe(0);
    content.deleteSelection(board);
    expect(found.length).toBe(0);
  });

  it("can suspend/resume syncChanges", () => {
    const content = defaultGeometryContent();
    const board = createDefaultBoard(content);
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
