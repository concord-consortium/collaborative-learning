import { JXGChangeAgent, JXGProperties } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { values } from "lodash";
import { isMovableLine } from "./jxg-movable-line";
import { isPolygon } from "./jxg-polygon";
import { isBoard } from "./jxg-board";
import { isPoint } from "./jxg-point";

export const isCommentType = (v: any) => v && v.getAttribute("clientType") === "comment";

export const isComment = (v: any) => isCommentType(v) && (v instanceof JXG.Text) && (v.elType === "text");

export const getAnchor = (comment: JXG.Text) => {
  if (!isComment) return;
  const ancestors = values(comment.ancestors);
  return ancestors.length === 1
    ? ancestors[0]
    : ancestors.find(elem => isMovableLine(elem) || isPolygon(elem));
};

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

function setPositionOverride(method: number, coords: number[]) {
  this.setPositionDirectly(method, coords);
  if (this.relativeCoords) {
    // For elements with relative coordinates (i.e. anchored elements), the coordinates are not changed until
    // a redraw occurs. If redraws are suspended, sequential translation deltas are calculated from the wrong point
    // unless the coordinates are manually set here. See JXG.CoordsElement#setPositionDirectly for more detail.
    this.coords.setCoordinates(method, coords);
  }
  return this;
}
JXG.Text.prototype.setPosition = setPositionOverride;

function getCentroid(anchor: JXG.GeometryElement) {
  if (isPoint(anchor)) {
    const coords = (anchor as JXG.Point).coords.usrCoords;
    return [coords[1], coords[2]];
  } else if (anchor) {
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
    } else {
      center[0] = NaN;
      center[1] = NaN;
    }
    return center;
  }
}

export const commentChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const commentProps = {
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

      const id = changeProps.id;
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
      if (position) {
        obj.setPosition(JXG.COORDS_BY_USER, position);
        board.update();
      }
    }
  },

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
