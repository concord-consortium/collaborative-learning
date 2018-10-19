import { types, Instance } from "mobx-state-tree";
import { applyChange, applyChanges } from "./jxg-dispatcher";
import { JXGChange, JXGProperties, JXGCoordPair } from "./jxg-changes";
import { isFreePoint } from "./jxg-point";
import { assign } from "lodash";
import * as uuid from "uuid/v4";
import { isBoard } from "./jxg-board";

export const kGeometryToolID = "Geometry";

export const kGeometryDefaultHeight = 320;
// matches curriculum images
export const kGeometryDefaultPixelsPerUnit = 18.3;
export const kGeometryDefaultAxisMin = -1;

export type onCreateCallback = (elt: JXG.GeometryElement) => void;

export function defaultGeometryContent(overrides?: JXGProperties) {
  const xAxisMax = 30;
  const yAxisMax = kGeometryDefaultHeight / kGeometryDefaultPixelsPerUnit - kGeometryDefaultAxisMin;
  const change: JXGChange = {
    operation: "create",
    target: "board",
    properties: assign({
                  id: uuid(),
                  axis: true,
                  boundingBox: [kGeometryDefaultAxisMin, yAxisMax, xAxisMax, kGeometryDefaultAxisMin],
                  grid: {}  // defaults to 1-unit gridlines
                }, overrides)
  };
  const changeJson = JSON.stringify(change);
  return GeometryContentModel.create({ changes: [changeJson] });
}

export const GeometryContentModel = types
  .model("GeometryContent", {
    type: types.optional(types.literal(kGeometryToolID), kGeometryToolID),
    changes: types.array(types.string)
  })
  .extend(self => {

    let viewCount = 0;
    let suspendCount = 0;
    let batchChanges: string[] = [];

    // views

    // actions
    function initializeBoard(domElementID: string, onCreate?: onCreateCallback): JXG.Board | undefined {
      const changes = self.changes.map(change => JSON.parse(change));
      let board;
      applyChanges(domElementID, changes)
        .filter(result => result != null)
        .forEach(elt => {
          if (isBoard(elt)) {
            board = elt as JXG.Board;
          }
          else if (elt && onCreate) {
            onCreate(elt as JXG.GeometryElement);
          }
        });
      return board;
    }

    function destroyBoard(board: JXG.Board) {
      JXG.JSXGraph.freeBoard(board);
    }

    function resizeBoard(board: JXG.Board, width: number, height: number, scale?: number) {
      const scaledWidth = width / (scale || 1);
      const scaledHeight = height / (scale || 1);
      const unitXY = kGeometryDefaultPixelsPerUnit;
      const [xMin, , , yMin] = board.attr.boundingbox;
      const newXMax = scaledWidth / unitXY + xMin;
      const newYMax = scaledHeight / unitXY + yMin;
      board.resizeContainer(scaledWidth, scaledHeight, false, true);
      board.setBoundingBox([xMin, newYMax, newXMax, yMin], true);
      board.update();
    }

    function updateScale(board: JXG.Board, scale: number) {
      // Ostensibly, the "right" thing to do here is to call
      // board.updateCSSTransforms(), but that call inexplicably incorporates
      // the scale factor multiple times as it walks the DOM hierarchy, so we
      // just skip the DOM walk and set the transform to the correct value.
      if (board) {
        const invScale = 1 / (scale || 1);
        const cssTransMat = [
                [1, 0, 0],
                [0, invScale, 0],
                [0, 0, invScale]
              ];
        board.cssTransMat = cssTransMat;
      }
    }

    function addChange(change: JXGChange) {
      self.changes.push(JSON.stringify(change));
    }

    function addImage(board: JXG.Board,
                      url: string,
                      coords: JXGCoordPair,
                      size: JXGCoordPair,
                      properties?: JXGProperties): JXG.Image | undefined {
      const change: JXGChange = {
        operation: "create",
        target: "image",
        parents: [url, coords, size],
        properties: assign({ id: uuid() }, properties)
      };
      const image = _applyChange(board, change);
      return image ? image as JXG.Image : undefined;
    }

    function addPoint(board: JXG.Board, parents: any, properties?: JXGProperties): JXG.Point | undefined {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents,
        properties: assign({ id: uuid() }, properties)
      };
      const point = _applyChange(board, change);
      return point ? point as JXG.Point : undefined;
    }

    function removeObjects(board: JXG.Board, id: string | string[]) {
      const change: JXGChange = {
        operation: "delete",
        target: "object",
        targetID: id
      };
      return _applyChange(board, change);
    }

    function updateObjects(board: JXG.Board, ids: string | string[], properties: JXGProperties | JXGProperties[]) {
      const change: JXGChange = {
              operation: "update",
              target: "object",
              targetID: ids,
              properties
            };
      return _applyChange(board, change);
    }

    function createPolygonFromFreePoints(board: JXG.Board, properties?: JXGProperties): JXG.Polygon | undefined {
      const freePtIds = board.objectsList
                          .filter(elt => isFreePoint(elt))
                          .map(pt => pt.id);
      if (freePtIds && freePtIds.length > 1) {
        const change: JXGChange = {
                operation: "create",
                target: "polygon",
                parents: freePtIds,
                properties: assign({ id: uuid() }, properties)
              };
        const polygon = _applyChange(board, change);
        return polygon ? polygon as JXG.Polygon : undefined;
      }
    }

    function findObjects(board: JXG.Board, test: (obj: JXG.GeometryElement) => boolean): JXG.GeometryElement[] {
      return board.objectsList.filter(test);
    }

    function _applyChange(board: JXG.Board, change: JXGChange) {
      const result = syncChange(board, change);
      const jsonChange = JSON.stringify(change);
      if (suspendCount <= 0) {
        self.changes.push(jsonChange);
      }
      else {
        batchChanges.push(jsonChange);
      }
      return result;
    }

    function syncChange(board: JXG.Board, change: JXGChange) {
      if (board) {
        return applyChange(board, change);
      }
    }

    return {
      views: {
        get nextViewId() {
          return ++viewCount;
        },
        get isUserResizable() {
          return true;
        },
        get batchChangeCount() {
          return batchChanges.length;
        }
      },
      actions: {
        initializeBoard,
        destroyBoard,
        resizeBoard,
        updateScale,
        addChange,
        addImage,
        addPoint,
        removeObjects,
        updateObjects,
        createPolygonFromFreePoints,
        findObjects,
        applyChange: _applyChange,
        syncChange,

        suspendSync() {
          ++suspendCount;
        },
        resumeSync() {
          if (--suspendCount <= 0) {
            self.changes.push.apply(self.changes, batchChanges);
            batchChanges = [];
          }
        }
      }
    };
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
