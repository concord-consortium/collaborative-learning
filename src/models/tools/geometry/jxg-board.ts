import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import "./jxg";
import { assign, find } from "lodash";

export const isBoard = (v: any) => v instanceof JXG.Board;

export const getElementByUuid = (board: JXG.Board, uuid: string): JXG.GeometryElement | undefined => {
  return find(board.objectsList, elt => elt._uuid_ === uuid);
};

export const boardChangeAgent: JXGChangeAgent = {
  create: (board: JXG.Board|string, change: JXGChange) => {
    const domElementID = board as string;
    const defaults = {
            keepaspectratio: true,
            showCopyright: false,
            showNavigation: false
          };
    const props = assign(defaults, change.properties);
    return JXG.JSXGraph.initBoard(domElementID, props);
  },

  update: (board: JXG.Board, change: JXGChange) => {
    return board;
  },

  delete: (board: JXG.Board, change: JXGChange) => {
    JXG.JSXGraph.freeBoard(board);
    return undefined;
  }
};
