import { JXGChangeAgent, JXGCoordPair, ILinkProperties } from "./jxg-changes";
import { createPoint, isPoint, pointChangeAgent } from "./jxg-point";
import { ITableLinkProperties } from "../table/table-content";

export const isLinkedPoint = (v: any) => isPoint(v) && (v.getAttribute("clientType") === "linkedPoint");

// Eventually should use a different color for each table
const linkedPointColor = "#0099FF";

function createLinkedPoint(board: JXG.Board, parents: JXGCoordPair, props: any, links?: ILinkProperties) {
  const tableId = links && links.tileIds && links.tileIds[0];
  const linkedProps = {
          clientType: "linkedPoint",
          fixed: true,
          fillColor: linkedPointColor,
          linkedTableId: tableId
        };
  const _props = { ...props, ...linkedProps };
  return createPoint(board as JXG.Board, parents, _props);
}

function syncLinkedPoints(board: JXG.Board, links: ITableLinkProperties) {
  if (board && links && links.labels) {
    links.labels.forEach(item => {
      const { id, label } = item;
      const elt = board.objects[id];
      elt && elt.setAttribute({ name: label });
    });
  }
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

    syncLinkedPoints(board as JXG.Board, change.links as ITableLinkProperties);

    return result;
  },

  update: pointChangeAgent.update,

  delete: (board, change) => {
    pointChangeAgent.delete(board, change);

    syncLinkedPoints(board as JXG.Board, change.links as ITableLinkProperties);
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
      // during development id was initially stored in parents
      const tableId = change.targetID || (change.parents && change.parents[0]);
      const pts = board.objectsList.filter(elt => {
                    return isPoint(elt) && tableId && (elt.getAttribute("linkedTableId") === tableId);
                  });
      board.suspendUpdate();
      pts.reverse().forEach(pt => board.removeObject(pt));
      board.unsuspendUpdate();
    }
  }
};
