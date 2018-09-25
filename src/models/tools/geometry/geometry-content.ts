import { types, Instance } from "mobx-state-tree";
import { applyChange, applyChanges } from "./jxg-dispatcher";
import { JXGChange } from "./jxg-changes";
import { each } from "lodash";

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
    function initializeBoard(domElementID: string, readOnly?: boolean): JXG.Board | undefined {
      if (self.changes.length) {
        const changes = self.changes.map(change => JSON.parse(change));
        const board = applyChanges(domElementID, changes);
        if (readOnly) {
          each(board && board.objects || {}, obj => {
            if (obj instanceof JXG.GeometryElement) {
              // disable dragging, etc.
              obj.fixed = true;
            }
          });
        }
        return board;
      }
    }

    function destroyBoard(board: JXG.Board) {
      JXG.JSXGraph.freeBoard(board);
    }

    function resizeBoard(board: JXG.Board, width: number, height: number) {
      board.resizeContainer(width, height);
      board.update();
    }

    function addPoint(board: JXG.Board, parents: any, properties?: any) {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents,
        properties
      };
      return _applyChange(board, change);
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
        addPoint,
        applyChange: _applyChange,
        syncChange
      }
    };
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
