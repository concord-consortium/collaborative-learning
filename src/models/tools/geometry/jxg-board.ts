import { assign, each, find } from "lodash";
import "./jxg";
import { JXGChange, JXGChangeAgent, JXGProperties } from "./jxg-changes";
import {
  isAxis, isBoard, isLinkedPoint, isPoint,
  kGeometryDefaultAxisMin, kGeometryDefaultHeight, kGeometryDefaultPixelsPerUnit, kGeometryDefaultWidth, toObj
} from "./jxg-types";
import { goodTickValue } from "../../../utilities/graph-utils";
import { ITableLinkProperties } from "../table/table-change";

const kScalerClasses = ["canvas-scaler", "scaled-list-item"];

export function suspendBoardUpdates(board: JXG.Board) {
  if (board.suspendCount) {
    ++board.suspendCount;
  }
  else {
    board.suspendUpdate();
    board.suspendCount = 1;
  }
}

export function resumeBoardUpdates(board: JXG.Board) {
  if (!board.suspendCount) {
    console.warn("resumeBoardUpdates called for unsuspended board!");
  }
  else if (--board.suspendCount === 0) {
    board.unsuspendUpdate();
  }
}

export function getObjectById(board: JXG.Board, id: string): JXG.GeometryElement | undefined {
  let obj: JXG.GeometryElement | undefined = board.objects[id];
  if (!obj && id?.includes(":")) {
    // legacy support for early tiles in which points were identified by caseId,
    // before we added support for multiple columns, i.e. multiple points per row/case
    // newer code uses `${caseId}:${attrId}` for the id of points
    const caseId = id.split(":")[0];
    obj = board.objects[caseId];
  }
  return obj;
}

export function getPointsByCaseId(board: JXG.Board, caseId: string) {
  if (!caseId || caseId.includes(":")) {
    const obj = getObjectById(board, caseId);
    return obj ? [obj] : [];
  }
  return board.objectsList.filter(obj => isPoint(obj) && (obj.id.split(":")[0] === caseId));
}

export function syncLinkedPoints(board: JXG.Board, links: ITableLinkProperties) {
  if (board && links?.labels) {
    // build map of points associated with each case
    const ptsForCaseMap: Record<string, JXG.GeometryElement[]> = {};
    each(board.objects, (obj, id) => {
      if (isLinkedPoint(obj)) {
        const caseId = obj.getAttribute("linkedRowId");
        if (caseId) {
          if (!ptsForCaseMap[caseId]) ptsForCaseMap[caseId] = [obj];
          else ptsForCaseMap[caseId].push(obj);
        }
      }
    });
    // assign case label to each point associated with a given case
    links.labels.forEach(item => {
      const { id, label } = item;
      const ptsForCase = ptsForCaseMap[id];
      if (ptsForCase) {
        ptsForCase.forEach(pt => pt?.setAttribute({ name: label }));
      }
    });
  }
}

export const kAxisBuffer = 20;
export const getAxisType = (v: any) => {
  // stdform encodes orientation of axes
  const [ , stdFormY, stdFormX] = v.stdform;
  if (stdFormX) return "x";
  if (stdFormY) return "y";
};
export function getAxis(board: JXG.Board, type: "x" | "y") {
  return find(board.objectsList, obj => isAxis(obj) && (getAxisType(obj) === type));
}

function getClientAxisLabels(board: JXG.Board) {
  return ["x", "y"].map(xy => {
    const axis = getAxis(board, xy as "x" | "y");
    return axis?.getAttribute("clientName") as string | undefined;
  });
}

export function getBaseAxisLabels(board: JXG.Board) {
  const [xName, yName] = getClientAxisLabels(board);
  return [xName || "x", yName || "y"];
}

export function syncAxisLabels(board: JXG.Board, xAxisLabel: string, yAxisLabel: string) {
  const xAxis = getAxis(board, "x");
  const yAxis = getAxis(board, "y");
  if (xAxis) xAxis.name = xAxisLabel;
  if (yAxis) yAxis.name = yAxisLabel;
  if (xAxis || yAxis) board.update();
}

function getClientAxisAnnotations(board: JXG.Board) {
  return ["x", "y"].map(xy => {
    const axis = getAxis(board, xy as "x" | "y");
    return axis?.getAttribute("clientAnnotation") as string | undefined;
  });
}

export function getAxisAnnotations(board: JXG.Board) {
  const [xAnnotation, yAnnotation] = getClientAxisAnnotations(board);
  return [xAnnotation || "", yAnnotation || ""];
}

export function getTickValues(pixPerUnit: number) {
  // we use the range over a prototypical size (e.g. 480px) to determine tick values
  const protoRange = kGeometryDefaultWidth / pixPerUnit;
  const [majorTickDistance, minorTicks] = goodTickValue(protoRange);
  const minorTickDistance = majorTickDistance / (minorTicks + 1);
  return [majorTickDistance, minorTicks, minorTickDistance];
}

// function findNearestMinorTicks(board: JXG.Board, x: number, y: number) {
//   const [ , , xMinorTickDistance] = getTickValues(board.unitX);
//   const [ , , yMinorTickDistance] = getTickValues(board.unitY);
//   const xOut = xMinorTickDistance * Math.round(x / xMinorTickDistance);
//   const yOut = yMinorTickDistance * Math.round(y / yMinorTickDistance);
//   return [xOut, yOut];
// }

export const kReverse = true;
export function sortByCreation(board: JXG.Board, ids: string[], reverse = false) {
  const indices: { [id: string]: number } = {};
  board.objectsList.forEach((obj, index) => {
    indices[obj.id] = index;
  });
  ids.sort(reverse
            ? (a, b) => indices[b] - indices[a]
            : (a, b) => indices[a] - indices[b]);
}

function combineProperties(domElementID: string, defaults: any, changeProps: any, overrides: any) {
  const { id, ...otherProps } = changeProps;
  otherProps.boundingBox = scaleBoundingBoxToElement(domElementID, changeProps);
  return assign(defaults, otherProps, overrides);
}

function getCanvasScale(eltOrId: string | HTMLElement | null) {
  let elt = typeof eltOrId === "string"
              ? document.getElementById(eltOrId)
              : eltOrId;
  for ( ; elt != null; elt = elt.parentElement) {
    if (kScalerClasses.some(_class => elt?.classList.contains(_class))) {
      const transform = getComputedStyle(elt).transform;
      const match = transform && /(scale|matrix)\((.+)\)/.exec(transform);
      return match?.[2] ? parseFloat(match[2]) : 1;
    }
  }
  return 1;
}

function scaleBoundingBoxToElement(domElementID: string, changeProps: any) {
  const elt = document.getElementById(domElementID);
  const eltBounds = elt?.getBoundingClientRect();
  const eltWidth = eltBounds?.width || kGeometryDefaultWidth;
  const eltHeight = eltBounds?.height || kGeometryDefaultHeight;
  const { boundingBox }: { boundingBox: JXG.BoundingBox } = changeProps;
  const [unitX, unitY] = getAxisUnitsFromProps(changeProps, getCanvasScale(elt));
  // eslint-disable-next-line no-sparse-arrays
  const [xMin, , , yMin] = boundingBox || [kGeometryDefaultAxisMin, , , kGeometryDefaultAxisMin];
  const xMax = xMin + eltWidth / unitX;
  const yMax = yMin + eltHeight / unitY;
  return [xMin, yMax, xMax, yMin] as JXG.BoundingBox;
}

export function guessUserDesiredBoundingBox(board: JXG.Board) {
  const [xMin, yMax, xMax, yMin] = board.getBoundingBox();
  const unitX = board.unitX;
  const unitY = board.unitY;
  const xBufferRange = kAxisBuffer / unitX;
  const yBufferRange = kAxisBuffer / unitY;

  return [xMin + xBufferRange, yMax - yBufferRange, xMax - xBufferRange, yMin + yBufferRange];
}

function getAxisLabelsFromProps(props: JXGProperties) {
  const xName = props?.xName ?? props?.boardScale?.xName;
  const yName = props?.yName ?? props?.boardScale?.yName;
  return [xName, yName];
}

function getAxisAnnotationsFromProps(props: JXGProperties) {
  const xAnnotation = props?.xAnnotation ?? props?.boardScale?.xAnnotation;
  const yAnnotation = props?.yAnnotation ?? props?.boardScale?.yAnnotation;
  return [xAnnotation, yAnnotation];
}

function getAxisUnitsFromProps(props?: JXGProperties, scale = 1) {
  const unitX = props?.boardScale?.unitX || props?.unitX || kGeometryDefaultPixelsPerUnit;
  const unitY = props?.boardScale?.unitY || props?.unitY || kGeometryDefaultPixelsPerUnit;
  return [unitX * scale, unitY * scale];
}

function createBoard(domElementId: string, properties?: JXGProperties) {
  const defaults = {
          keepaspectratio: true,
          showCopyright: false,
          showNavigation: false,
          minimizeReflow: "none"
        };
  const [unitX, unitY] = getAxisUnitsFromProps(properties);
  // cf. https://www.intmath.com/cg3/jsxgraph-axes-ticks-grids.php
  const overrides = { axis: false, keepaspectratio: unitX === unitY };
  const props = combineProperties(domElementId, defaults, properties, overrides);
  const board = JXG.JSXGraph.initBoard(domElementId, props);
  return board;
}

interface IAddAxesParams {
  xName?: string;
  yName?: string;
  xAnnotation?: string;
  yAnnotation?: string;
  unitX: number;
  unitY: number;
  boundingBox?: JXG.BoundingBox;
}

function addAxes(board: JXG.Board, params: IAddAxesParams) {
  const { xName, yName, xAnnotation, yAnnotation, unitX, unitY, boundingBox } = params;
  const [xMajorTickDistance, xMinorTicks, xMinorTickDistance] = getTickValues(unitX);
  const [yMajorTickDistance, yMinorTicks, yMinorTickDistance] = getTickValues(unitY);
  board.removeGrids();
  board.options.grid = { ...board.options.grid, gridX: xMinorTickDistance, gridY: yMinorTickDistance };
  board.addGrid();
  if (boundingBox && boundingBox.every((val: number) => isFinite(val))) {
    board.setBoundingBox(boundingBox);
  }
  const xAxis = board.create("axis", [ [0, 0], [1, 0] ], {
    name: xName || "x",
    withLabel: true,
    label: {fontSize: 13, anchorX: "right", position: "rt", offset: [0, 15]},
    ...toObj("clientName", xName),
    ...toObj("clientAnnotation", xAnnotation)
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
    name: yName || "y",
    withLabel: true,
    label: {fontSize: 13, position: "rt", offset: [15, 0]},
    ...toObj("clientName", yName),
    ...toObj("clientAnnotation", yAnnotation)
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
  return [xAxis, yAxis];
}

export const boardChangeAgent: JXGChangeAgent = {
  create: (boardOrDomId: JXG.Board|string, change: JXGChange) => {
    const props = change.properties as JXGProperties;
    const board = isBoard(boardOrDomId)
                    ? boardOrDomId
                    : createBoard(boardOrDomId, props);
    // If we created the board from a DOM element ID, then we need to add the axes.
    // If we are undoing an action, then the board already exists but its axes have
    // been removed, so we have to add the axes in that case as well.
    const boundingBox = scaleBoundingBoxToElement(board.containerObj.id, props);
    const scale = getCanvasScale(board ? board.container : boardOrDomId as string);
    const [xName, yName] = getAxisLabelsFromProps(props);
    const [xAnnotation, yAnnotation] = getAxisAnnotationsFromProps(props);
    const [unitX, unitY] = getAxisUnitsFromProps(props, scale);
    const axes = addAxes(board, {
                          unitX, unitY, boundingBox,
                          ...toObj("xName", xName), ...toObj("yName", yName),
                          ...toObj("xAnnotation", xAnnotation), ...toObj("yAnnotation", yAnnotation)
                        });
    return [board, ...axes];
},

  update: (board: JXG.Board, change: JXGChange) => {
    if (!change.properties) { return; }
    const props = change.properties as JXGProperties;
    if (board) {
      const boardScale = props.boardScale;
      if (boardScale) {
        const { canvasWidth, canvasHeight } = boardScale;
        const [xClientName, yClientName] = getClientAxisLabels(board);
        const [xPropName, yPropName] = getAxisLabelsFromProps(props);
        const xName = xPropName ?? xClientName;
        const yName = yPropName ?? yClientName;
        const [xClientAnnotation, yClientAnnotation] = getClientAxisAnnotations(board);
        const [xPropAnnotation, yPropAnnotation] = getAxisAnnotationsFromProps(props);
        const xAnnotation = xPropAnnotation ?? xClientAnnotation;
        const yAnnotation = yPropAnnotation ?? yClientAnnotation;
        const width = board.canvasWidth;
        const height = board.canvasHeight;
        const widthMultiplier = (width - kAxisBuffer * 2) / canvasWidth;
        const heightMultiplier = (height - kAxisBuffer * 2) / canvasHeight;
        const unitX = boardScale.unitX;
        const unitY = boardScale.unitY;
        const xBuffer = kAxisBuffer / unitX;
        const yBuffer = kAxisBuffer / unitY;
        // The change might have been performed on a different-sized tile due to a 2-up switch or reload
        // In that case, we need to scale the min/max to preserve user-intended ratios
        const xMin = (boardScale.xMin * widthMultiplier) - xBuffer;
        const yMin = (boardScale.yMin * heightMultiplier) - yBuffer;
        if (isFinite(xMin) && isFinite(yMin) && isFinite(unitX) && isFinite(unitY)) {
          const xRange = width / unitX;
          const yRange = height / unitY;
          const bbox: JXG.BoundingBox = [xMin, yMin + yRange, xMin + xRange, yMin];
          suspendBoardUpdates(board);
          // remove old axes before resetting bounding box
          board.objectsList.forEach(el => {
            if (el.elType === "axis") {
              board.removeObject(el);
            }
          });
          // set new bounding box and then create new axes
          board.setBoundingBox(bbox);
          const axes = addAxes(board, {
                                unitX, unitY,
                                ...toObj("xName", xName), ...toObj("yName", yName),
                                ...toObj("xAnnotation", xAnnotation), ...toObj("yAnnotation", yAnnotation)
                              });
          resumeBoardUpdates(board);
          return axes;
        }
      }
    }
  },

  delete: (board: JXG.Board, change: JXGChange) => {
    JXG.JSXGraph.freeBoard(board);
  }
};
