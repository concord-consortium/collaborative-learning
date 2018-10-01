import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import "./jxg";
import { assign, each } from "lodash";

export const isBoard = (v: any) => v instanceof JXG.Board;

export const boardChangeAgent: JXGChangeAgent = {
  create: (board: JXG.Board|string, change: JXGChange) => {
    const domElementID = board as string;
    const defaults = {
            keepaspectratio: true,
            showCopyright: false,
            showNavigation: false,
            minimizeReflow: "none"
          };
    const props = assign(defaults, change.properties);
    return JXG.JSXGraph.initBoard(domElementID, props);
  },

  update: (board: JXG.Board, change: JXGChange) => {
    if (!change.targetID || !change.properties) { return; }
    const ids = Array.isArray(change.targetID) ? change.targetID : [change.targetID];
    const props = Array.isArray(change.properties) ? change.properties : [change.properties];
    ids.forEach((id, index) => {
      const brd = JXG.boards[id];
      const brdProps = index < props.length ? props[index] : props[0];
      if (brd && brdProps) {
        each(brdProps, (value, prop) => {
          switch (prop) {
            case "boundingBox":
              brd.setBoundingBox(value);
              break;
          }
        });
        brd.update();
      }
    });
  },

  delete: (board: JXG.Board, change: JXGChange) => {
    JXG.JSXGraph.freeBoard(board);
  }
};
