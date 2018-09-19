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

    // views

    // actions
    function initialize(domElementID: string): JXG.Board | undefined {
      if (self.changes.length) {
        const changes = self.changes.map(change => JSON.parse(change));
        return applyChanges(domElementID, changes);
      }
    }

    function destroy(board: JXG.Board) {
      JXG.JSXGraph.freeBoard(board);
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
      },
      actions: {
        initialize,
        destroy,
        addPoint,
        applyChange: _applyChange
      }
    };
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
