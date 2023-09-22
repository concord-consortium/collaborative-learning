import { getObjectById } from "./jxg-board";
import { JXGChangeAgent, JXGCoordPair } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { isBoard, isMovableLine, isPoint, isPolygon, isVisibleEdge } from "./jxg-types";
import { values } from "lodash";
import { uniqueId } from "../../../utilities/js-utils";

const sharedProps = {
  strokeWidth: 1,
  clientType: "comment",
  highlight: false,
  strokeColor: "white",
  clientStrokeColor: "white",
  clientSelectedStrokeColor: "white",
  fillColor: "red",
};

const pointProps = {
  ...sharedProps,
  withLabel: false,
  visible: false
};

const lineProps = {
  ...sharedProps,
  strokeColor: "black",
  strokeOpacity: .3,
  straightFirst: false,
  straightLast: false
};

function getCentroid(anchor: JXG.GeometryElement): JXGCoordPair | undefined{
  if (isPoint(anchor)) {
    const coords = anchor.coords.usrCoords;
    return [coords[1], coords[2]];
  } else if (isPolygon(anchor) || isMovableLine(anchor) || isVisibleEdge(anchor)) {
    const points = values(anchor.ancestors) as JXG.Point[];
    const center: JXGCoordPair = [0, 0];
    points.forEach((point) => {
      center[0] += point.coords.usrCoords[1];
      center[1] += point.coords.usrCoords[2];
    });
    const len = points.length;
    if (len) {
      center[0] /= len;
      center[1] /= len;
      return center;
    } else {
      return undefined;
    }
  }
}

export const commentChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const inParents = change.parents?.[0] && change.parents?.[1] ? change.parents : undefined;
    const { text, ...changeProps } = (change.properties || {}) as any;
    const commentText = text || "";
    const commentProps = {
      id: uniqueId(),
      ...sharedProps,
      cssClass: "comment",
      clientCssClass: "comment",
      clientSelectedCssClass: "comment selected",
      strokeColor: "white",
      fontSize: 13,
      ...changeProps,
    };
    if (isBoard(board)) {
      const _board = board;
      // returns a function that computes the specified centroid coordinate dynamically
      const centroidCoordinateGetter = (index: number) => () => {
        const anchor = getObjectById(_board, commentProps.anchor);
        const centroid = anchor && getCentroid(anchor);
        if (centroid) {
          return centroid[index];
        }
      };
      // Comments on table-linked points will not copy to new documents because the anchor isn't copied
      if (!getObjectById(_board, commentProps.anchor)) return;

      // default centers the left edge of the comment one unit below the centroid of its anchor element
      const coords = inParents || [0, -1];
      const id = commentProps.id;
      const comment = _board.create("text", [...coords, commentText], commentProps);
      const commentPoint = _board.create(
        "point",
        [1, 0], // places the end point of the comment line one unit to the right of the left edge of the comment
        { ...pointProps, anchor: comment.id, id: `${id}-commentPoint` }
      );
      const anchorPoint = _board.create(
        "point",
        // pass functions so that centroid is computed dynamically as anchor changes
        [centroidCoordinateGetter(0), centroidCoordinateGetter(1)],
        { ...pointProps, id: `${id}-anchorPoint` }
      );
      const line = _board.create(
        "line",
        [anchorPoint, commentPoint],
        { ...lineProps, id: `${id}-labelLine` });
      return [comment, commentPoint, anchorPoint, line];
    }
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
