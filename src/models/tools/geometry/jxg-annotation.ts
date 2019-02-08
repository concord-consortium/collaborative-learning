import { JXGChangeAgent, JXGProperties } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { values } from "lodash";
import { isMovableLine } from "./jxg-movable-line";
import { isPolygon } from "./jxg-polygon";
import { isBoard } from "./jxg-board";
import { isPoint } from "./jxg-point";

export const isAnnotationType = (v: any) => v && v.getAttribute("clientType") === "annotation";

export const isAnnotation = (v: any) => isAnnotationType(v) && (v instanceof JXG.Text) && (v.elType === "text");

export const getAnchor = (annotation: JXG.Text) => {
  if (!isAnnotation) return;
  const ancestors = values(annotation.ancestors);
  return ancestors.length === 1
    ? ancestors[0]
    : ancestors.find(elem => isMovableLine(elem) || isPolygon(elem));
};

const sharedProps = {
  strokeWidth: 1,
  clientType: "annotation",
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
  }
  if (isMovableLine(anchor) || isPolygon(anchor)) {
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

export const annotationChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const annotationProps = {
      ...sharedProps,
      cssClass: "annotation",
      clientCssClass: "annotation",
      clientSelectedCssClass: "annotation selected",
      strokeColor: "white",
      fontSize: 13,
      ...changeProps,
    };
    if (isBoard(board)) {
      const _board = board as JXG.Board;
      const centroidCoordinateGetter = (index: number) => () => {
        const anchor = _board.objects[annotationProps.anchor];
        const centroid = getCentroid(anchor);
        if (centroid) {
          return centroid[index];
        }
      };

      const id = changeProps.id;
      const annotation = _board.create("text", [0, -1, ""], annotationProps);
      const annotationPoint = _board.create(
        "point",
        [1, 0],
        { ...pointProps, anchor: annotation.id, id: `${id}-annotationPoint` }
      );
      const anchorPoint = _board.create(
        "point",
        [centroidCoordinateGetter(0), centroidCoordinateGetter(1)],
        { ...pointProps, id: `${id}-anchorPoint` }
      );
      const line = _board.create(
        "line",
        [anchorPoint, annotationPoint],
        { ...lineProps, id: `${id}-labelLine`});
      return [annotation, annotationPoint, anchorPoint, line];
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
