import { types, Instance } from "mobx-state-tree";
import { applyChange, applyChanges } from "./jxg-dispatcher";
import { JXGChange, JXGElement, JXGProperties } from "./jxg-changes";
import { isFreePoint } from "./jxg-point";
import { assign } from "lodash";
import * as uuid from "uuid/v4";

export const kGeometryToolID = "Geometry";

export const kGeometryDefaultHeight = 200;

export function defaultGeometryContent(overrides?: JXGProperties) {
  const axisMin = -0.5;
  const xAxisMax = 20;
  const yAxisMax = 5;
  const change: JXGChange = {
    operation: "create",
    target: "board",
    properties: assign({
                  id: uuid(),
                  axis: true,
                  boundingBox: [axisMin, yAxisMax, xAxisMax, axisMin],
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
    function initializeBoard(domElementID: string, readOnly?: boolean): JXGElement[] {
      const changes = self.changes.map(change => JSON.parse(change));
      return applyChanges(domElementID, changes)
              .filter(result => result != null)
              .map(elt => {
                if (readOnly && (elt instanceof JXG.GeometryElement)) {
                  elt.setAttribute({ fixed: true });
                }
                return elt;
              }) as JXGElement[];
    }

    function destroyBoard(board: JXG.Board) {
      JXG.JSXGraph.freeBoard(board);
    }

    function resizeBoard(board: JXG.Board, width: number, height: number) {
      board.resizeContainer(width, height);
      board.update();
    }

    function addChange(change: JXGChange) {
      self.changes.push(JSON.stringify(change));
    }

    function addPoint(board: JXG.Board, parents: any, properties?: JXGProperties) {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents,
        properties: assign({ id: uuid() }, properties)
      };
      return _applyChange(board, change);
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

    function connectFreePoints(board: JXG.Board) {
      const freePtIds = board.objectsList
                          .filter(elt => isFreePoint(elt))
                          .map(pt => pt.id);
      if (freePtIds && freePtIds.length > 1) {
        const change: JXGChange = {
                operation: "create",
                target: "polygon",
                parents: freePtIds,
                properties: { id: uuid() }
              };
        return _applyChange(board, change);
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
        }
      },
      actions: {
        initializeBoard,
        destroyBoard,
        resizeBoard,
        addChange,
        addPoint,
        removeObjects,
        updateObjects,
        connectFreePoints,
        applyChange: _applyChange,
        syncChange
      }
    };
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
