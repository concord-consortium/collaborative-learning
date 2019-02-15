import { JXGChange, JXGChangeAgent, JXGProperties } from "./jxg-changes";
import "./jxg";
import { goodTickValue } from "../../../utilities/graph-utils";
import { assign, each, find } from "lodash";

export const kGeometryProtoSize = 480;
export const kGeometryDefaultPixelsPerUnit = 18.3;  // matches S&S curriculum images
export const kGeometryDefaultAxisMin = -1;
export const isBoard = (v: any) => v instanceof JXG.Board;
export const isAxis = (v: any) => (v instanceof JXG.Line) && (v.elType === "axis");
export const getAxisType = (v: any) => {
  // stdform encodes orientation of axes
  const [ , stdFormY, stdFormX] = v.stdform;
  if (stdFormX) return "x";
  if (stdFormY) return "y";
};
export function getAxis(board: JXG.Board, type: "x" | "y") {
  return find(board.objectsList, obj => isAxis(obj) && (getAxisType(obj) === type));
}

export function syncAxisLabels(board: JXG.Board, xAxisLabel: string, yAxisLabel: string) {
  const xAxis = getAxis(board, "x");
  const yAxis = getAxis(board, "y");
  if (xAxis) xAxis.name = xAxisLabel;
  if (yAxis) yAxis.name = yAxisLabel;
  if (xAxis || yAxis) board.update();
}

export function getTickValues(pixPerUnit: number) {
  // we use the range over a prototypical size (e.g. 480px) to determine tick values
  const protoRange = kGeometryProtoSize / pixPerUnit;
  const [majorTickDistance, minorTicks] = goodTickValue(protoRange);
  const minorTickDistance = majorTickDistance / (minorTicks + 1);
  return [majorTickDistance, minorTicks, minorTickDistance];
}

export const kReverse = true;
export function sortByCreation(board: JXG.Board, ids: string[], reverse: boolean = false) {
  const indices: { [id: string]: number } = {};
  board.objectsList.forEach((obj, index) => {
    indices[obj.id] = index;
  });
  ids.sort(reverse
            ? (a, b) => indices[b] - indices[a]
            : (a, b) => indices[a] - indices[b]);
}

function combineProperties(domElementID: string, defaults: any, changeProps: any, overrides: any) {
  const elt = document.getElementById(domElementID);
  const eltBounds = elt && elt.getBoundingClientRect();
  const { id, ...otherProps } = changeProps;
  if (eltBounds) {
    // adjust boundingBox to actual size of dom element
    const { boundingBox, unitX, unitY } = changeProps;
    const [xMin, , , yMin] = boundingBox || [kGeometryDefaultAxisMin, , , kGeometryDefaultAxisMin];
    const xMax = xMin + eltBounds.width / (unitX || kGeometryDefaultPixelsPerUnit);
    const yMax = yMin + eltBounds.height / (unitY || kGeometryDefaultPixelsPerUnit);
    otherProps.boundingBox = [xMin, yMax, xMax, yMin];
  }
  return assign(defaults, otherProps, overrides);
}

export const boardChangeAgent: JXGChangeAgent = {
  create: (boardDomId: JXG.Board|string, change: JXGChange) => {
    const domElementID = boardDomId as string;
    const defaults = {
            keepaspectratio: true,
            showCopyright: false,
            showNavigation: false,
            minimizeReflow: "none"
          };
    const changeProps = change.properties && change.properties as JXGProperties;
    const unitX = changeProps && changeProps.unitX || kGeometryDefaultPixelsPerUnit;
    const unitY = changeProps && changeProps.unitY || kGeometryDefaultPixelsPerUnit;
    const [xMajorTickDistance, xMinorTicks, xMinorTickDistance] = getTickValues(unitX);
    const [yMajorTickDistance, yMinorTicks, yMinorTickDistance] = getTickValues(unitY);
    // cf. https://www.intmath.com/cg3/jsxgraph-axes-ticks-grids.php
    const overrides = { axis: false, keepaspectratio: unitX === unitY,
                        grid: { gridX: xMinorTickDistance, gridY: yMinorTickDistance } };
    const props = combineProperties(domElementID, defaults, change.properties, overrides);
    const board = isBoard(boardDomId) ? boardDomId as JXG.Board : JXG.JSXGraph.initBoard(domElementID, props);
    const xAxis = board.create("axis", [ [0, 0], [1, 0] ], {
                                name: "x",
                                withLabel: true,
                                label: {fontSize: 13, anchorX: "right", position: "rt", offset: [0, 15]}
                  });
    xAxis.removeAllTicks();
    board.create("ticks", [xAxis, xMajorTickDistance], {
                  strokeColor: "#bbb",
                  majorHeight: -1,
                  drawLabels: true,
                  label: { anchorX: "middle", offset: [-8, -10] },
                  minorTicks: xMinorTicks,
                  drawZero: true
                });
    const yAxis = board.create("axis", [ [0, 0], [0, 1] ], {
                                name: "y",
                                withLabel: true,
                                label: {fontSize: 13, position: "rt", offset: [15, 0]}
                  });
    yAxis.removeAllTicks();
    board.create("ticks", [yAxis, yMajorTickDistance], {
                  strokeColor: "#bbb",
                  majorHeight: -1,
                  drawLabels: true,
                  label: { anchorX: "right", offset: [-4, -1] },
                  minorTicks: yMinorTicks,
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
