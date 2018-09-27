import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import "./jxg";

export const isPolygon = (v: any) => v instanceof JXG.Polygon;

export const polygonChangeAgent: JXGChangeAgent = {
  create: (board: JXG.Board, change: JXGChange) => {
    const parents = (change.parents || []).map(id => board.objects[id]);
    return board.create("polygon", parents);
  },

  update: (board: JXG.Board, change: JXGChange) => {
    return;
  },

  delete: (board: JXG.Board, change: JXGChange) => {
    return;
  }
};
