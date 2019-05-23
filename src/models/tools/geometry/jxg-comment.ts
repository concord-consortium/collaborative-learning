import { JXGChangeAgent, JXGProperties, JXGCoordPair } from "./jxg-changes";
import { isBoard } from "./jxg-board";
import { isMovableLine } from "./jxg-movable-line";
import { objectChangeAgent, isPositionGraphable } from "./jxg-object";
import { isPoint } from "./jxg-point";
import { isPolygon, isVisibleEdge } from "./jxg-polygon";
import { values } from "lodash";
import { uniqueId } from "../../../utilities/js-utils";

export const isCommentType = (v: any) => v && v.getAttribute("clientType") === "comment";

export const isComment = (v: any) => isCommentType(v) && (v instanceof JXG.Text) && (v.elType === "text");

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

function getCentroid(anchor: JXG.GeometryElement) {
  if (isPoint(anchor)) {
    const coords = (anchor as JXG.Point).coords.usrCoords;
    return [coords[1], coords[2]];
  } else if (isPolygon(anchor) || isMovableLine(anchor) || isVisibleEdge(anchor)) {
    const points = values(anchor.ancestors) as JXG.Point[];
    const center = [0.0, 0.0];
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
    const changeProps: any = change.properties || {};
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
      const _board = board as JXG.Board;
      const centroidCoordinateGetter = (index: number) => () => {
        const anchor = _board.objects[commentProps.anchor];
        const centroid = getCentroid(anchor);
        if (centroid) {
          return centroid[index];
        }
      };
      // Comments on table-linked points will not copy to new documents because the anchor isn't copied
      if (!_board.objects[commentProps.anchor]) return;

      const id = commentProps.id;
      const comment = _board.create("text", [0, -1, ""], commentProps);
      const commentPoint = _board.create(
        "point",
        [1, 0],
        { ...pointProps, anchor: comment.id, id: `${id}-commentPoint` }
      );
      const anchorPoint = _board.create(
        "point",
        [centroidCoordinateGetter(0), centroidCoordinateGetter(1)],
        { ...pointProps, id: `${id}-anchorPoint` }
      );
      const line = _board.create(
        "line",
        [anchorPoint, commentPoint],
        { ...lineProps, id: `${id}-labelLine`});
      return [comment, commentPoint, anchorPoint, line];
    }
  },

  update: (board, change) => {
    if (!change.targetID || !change.properties) { return; }
    const id = change.targetID as string;
    const obj = board.objects[id] as JXG.Text;
    if (obj) {
      const props = change.properties as JXGProperties;
      const { text, position } = props;
      if (text != null) {
        obj.setText(text);
        board.update();
      }
      if (position && isPositionGraphable(position)) {
        // Element coordinates are not updated until a redraw occurs. So if redraws are suspended, and a comment or its
        // anchor has moved, the transform will be calculated from a stale position. We unsuspend updates to force a
        // refresh on coordinate positions.
        const wasSuspended = board.isSuspendedUpdate;
        if (wasSuspended) board.unsuspendUpdate();
        obj.setPosition(JXG.COORDS_BY_USER, position as JXGCoordPair);
        board.update();
        if (wasSuspended) board.suspendUpdate();
      }
      // other properties can be handled generically
      objectChangeAgent.update(board, change);
    }
  },

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
