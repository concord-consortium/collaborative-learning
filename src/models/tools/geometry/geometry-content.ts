import { types, Instance } from "mobx-state-tree";
import { applyChange, applyChanges } from "./jxg-dispatcher";
import { JXGChange, JXGElement, JXGProperties } from "./jxg-changes";
import { isFreePoint } from "./jxg-point";
import { assign } from "lodash";
import * as uuid from "uuid/v4";

export const kGeometryToolID = "Geometry";

export const GeometryContentModel = types
  .model("GeometryContent", {
    type: types.literal(kGeometryToolID),
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

    function updatePoints(board: JXG.Board, ids: string | string[], properties: JXGProperties | JXGProperties[]) {
      const change: JXGChange = {
              operation: "update",
              target: "point",
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
                parents: freePtIds
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
        updatePoints,
        connectFreePoints,
        applyChange: _applyChange,
        syncChange
      }
    };
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
