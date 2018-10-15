import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import "./jxg";
import { assign, each } from "lodash";
import * as uuid from "uuid/v4";

export const isBoard = (v: any) => v instanceof JXG.Board;

export const boardChangeAgent: JXGChangeAgent = {
  create: (boardDomId: JXG.Board|string, change: JXGChange) => {
    const domElementID = boardDomId as string;
    const defaults = {
            id: uuid(),
            keepaspectratio: true,
            showCopyright: false,
            showNavigation: false,
            minimizeReflow: "none"
          };
    // cf. https://www.intmath.com/cg3/jsxgraph-axes-ticks-grids.php
    const overrides = { axis: false, grid: true };
    const props = assign(defaults, change.properties, overrides);
    const board = JXG.JSXGraph.initBoard(domElementID, props);
    const xAxis = board.create("axis", [ [0, 0], [1, 0] ]);
    xAxis.removeAllTicks();
    board.create("ticks", [xAxis, 5], {
                  strokeColor: "#bbb",
                  majorHeight: -1,
                  drawLabels: true,
                  label: { offset: [-8, -10] },
                  minorTicks: 4,
                  drawZero: true
                });
    const yAxis = board.create("axis", [ [0, 0], [0, 1] ]);
    yAxis.removeAllTicks();
    board.create("ticks", [yAxis, 5], {
                  strokeColor: "#bbb",
                  majorHeight: -1,
                  drawLabels: true,
                  label: { offset: [-16, -1] },
                  minorTicks: 4,
                  drawZero: false
                });
    return board;
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
