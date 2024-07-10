import { splitLinkedPointId } from "../table-link-types";
import { filterBoardObjects, forEachBoardObject } from "./geometry-utils";
import { resumeBoardUpdates, suspendBoardUpdates } from "./jxg-board";
import { ILinkProperties, JXGChange, JXGChangeAgent, JXGCoordPair } from "./jxg-changes";
import { createPoint, pointChangeAgent } from "./jxg-point";
import { isPoint } from "./jxg-types";

export function getTableIdFromLinkChange(change: JXGChange) {
  return change.target.toLowerCase() === "tablelink"
          // during development id was initially stored in parents
          ? (change.targetID || change.parents?.[0]) as string
          : undefined;
}

export interface ITableLinkColors {
  fill: string;
  stroke: string;
}

export function createLinkedPoint(board: JXG.Board, parents: JXGCoordPair, props: any, links?: ILinkProperties) {
  const tableId = links?.tileIds?.[0];
  const [linkedRowId, linkedColId] = splitLinkedPointId(props?.id);
  const linkedProps = {
          clientType: "linkedPoint",
          fixed: true,
          linkedTableId: tableId,
          linkedRowId,
          linkedColId
        };
  const _props = { ...props, ...linkedProps };
  return createPoint(board, parents, _props);
}

export function getAllLinkedPoints(board: JXG.Board) {
  const ids: string[] = [];
  forEachBoardObject(board, obj => {
    if (obj.elType === "point" && obj.getAttribute("clientType") === "linkedPoint") {
      ids.push(obj.id);
    }
  });
  return ids;
}

export const linkedPointChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    let result: JXG.Point | JXG.Point[] = [];
    const parents = change.parents;
    const props: any = change.properties;
    if (Array.isArray(parents && parents[0])) {
      result = (parents || []).map((coords, i) => {
        return createLinkedPoint(board as JXG.Board, coords as JXGCoordPair, props && props[i], change.links);
      });
    }
    else {
      result = createLinkedPoint(board as JXG.Board, change.parents as JXGCoordPair, change.properties, change.links);
    }
    return result;
  },

  update: pointChangeAgent.update,

  delete: (board, change) => {
    pointChangeAgent.delete(board, change);
  }
};

export const tableLinkChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const ids = changeProps.ids || [];
    const points = changeProps.points || [];
    const count = Math.min(ids.length, points.length);
    const newPts: JXG.Point[] = [];
    for (let i = 0; i < count; ++i) {
      const parents = points[i].coords || points[i];
      const props = { id: ids[i], name: points[i].label };
      const newPt = createLinkedPoint(board as JXG.Board, parents, props, change.links);
      if (newPt) {
        newPts.push(newPt as JXG.Point);
      }
    }
    return newPts;
  },

  update: (board, change) => undefined,

  delete: (board, change) => {
    if (board) {
      const tableId = getTableIdFromLinkChange(change);
      const pts = filterBoardObjects(board, elt => {
                    return isPoint(elt) && tableId && (elt.getAttribute("linkedTableId") === tableId);
                  });
      suspendBoardUpdates(board);
      pts.reverse().forEach(pt => board.removeObject(pt));
      resumeBoardUpdates(board);
    }
  }
};
