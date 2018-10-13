import { types, Instance } from "mobx-state-tree";
import { applyChange, applyChanges } from "./jxg-dispatcher";
import { JXGChange, JXGElement, JXGProperties, JXGCoordPair } from "./jxg-changes";
import { isFreePoint } from "./jxg-point";
import { assign } from "lodash";
import * as uuid from "uuid/v4";
import { isBoard } from "./jxg-board";

export const kGeometryToolID = "Geometry";

export const kGeometryDefaultHeight = 200;
// matches curriculum images
export const kGeometryDefaultPixelsPerUnit = 26;
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

    function _applyChange(board: JXG.Board, change: JXGChange) {
      const result = syncChange(board, change);
      self.changes.push(JSON.stringify(change));
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
        }
      },
      actions: {
        initializeBoard,
        destroyBoard,
        resizeBoard,
        addChange,
        addImage,
        addPoint,
        removeObjects,
        updateObjects,
        createPolygonFromFreePoints,
        applyChange: _applyChange,
        syncChange
      }
    };
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
