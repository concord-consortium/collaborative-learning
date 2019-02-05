import { JXGChangeAgent, JXGProperties } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { values } from "lodash";
import { isMovableLine } from "./jxg-movable-line";
import { isPolygon } from "./jxg-polygon";
import { isBoard } from "./jxg-board";

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
};

const pointProps = {
  ...sharedProps,
  withLabel: false,
  visible: false
};

const lineProps = {
  ...sharedProps,
  strokeColor: "black",
  straightFirst: false,
  straightLast: false
};

export const annotationChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const annotationProps = {
      ...sharedProps,
      cssClass: "annotation",
      highlightCssClass: "annotation",
      strokeColor: "white",
      fontSize: 13,
      ...changeProps,
    };
    if (isBoard(board)) {
      const _board = board as JXG.Board;

      const annotation = _board.create("text", [0, -1, "annotation"], annotationProps);
      const annotationPoint = _board.create("point", [1, 0], { ...pointProps, anchor: annotation.id });
      const anchorPoint = _board.create("point", [0, 0], { ...pointProps, anchor: annotationProps.anchor });
      const line = _board.create("line", [anchorPoint, annotationPoint], lineProps);
      return [annotation, annotationPoint, anchorPoint, line];
    }
  },

  update: (board, change) => {
    if (!change.targetID || !change.properties) { return; }
    const id = change.targetID as string;
    const props = change.properties as JXGProperties;
    const obj = board.objects[id] as JXG.Text;
    const text = props.text;
    if (obj && text) {
      obj.setText(text);
    }
  },

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
