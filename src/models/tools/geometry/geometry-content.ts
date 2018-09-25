import { types, Instance } from "mobx-state-tree";
import { applyChange, applyChanges } from "./jxg-dispatcher";
import { JXGChange } from "./jxg-changes";

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
    function initializeBoard(domElementID: string): JXG.Board | undefined {
      if (self.changes.length) {
        const changes = self.changes.map(change => JSON.parse(change));
        return applyChanges(domElementID, changes);
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
      _applyChange(board, change);
    }

    function _applyChange(board: JXG.Board, change: JXGChange) {
      if (board) {
        applyChange(board, change);
      }
      self.changes.push(JSON.stringify(change));
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
        applyChange: _applyChange
      }
    };
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
