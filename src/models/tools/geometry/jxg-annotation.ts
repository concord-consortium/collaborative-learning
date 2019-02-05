import { JXGChangeAgent, JXGProperties } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { values } from "lodash";
import { isMovableLine } from "./jxg-movable-line";
import { isPolygon } from "./jxg-polygon";
import { isBoard } from "./jxg-board";

export const isAnnotation = (v: any) =>
                (v instanceof JXG.Text) && (v.elType === "text") &&
                (v.getAttribute("clientType") === "annotation");

export const getAnchor = (annotation: JXG.Text) => {
  if (!isAnnotation) return;
  const ancestors = values(annotation.ancestors);
  return ancestors.length === 1
    ? ancestors[0]
    : ancestors.find(elem => isMovableLine(elem) || isPolygon(elem));
};

export const kPointDefaults = {
              fillColor: "#CCCCCC",
              strokeColor: "#888888",
              selectedFillColor: "#FF0000",
              selectedStrokeColor: "#FF0000"
            };

const defaultProps = {
        fillColor: kPointDefaults.fillColor,
        strokeColor: kPointDefaults.strokeColor
      };

export const annotationChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const props = {
      ...changeProps,
      cssClass: "annotation",
      highlightCssClass: "annotation",
      clientType: "annotation"
    };
    if (isBoard(board)) {
      const _board = board as JXG.Board;

      const pointProps = {
        withLabel: false,
        visible: false
      };
      const annotation = _board.create("text", [0, -1, "annotation"], props);
      const annotationPoint = _board.create("point", [0, 0], { ...pointProps, anchor: annotation.id });
      const anchorPoint = _board.create("point", [0, 0], { ...pointProps, anchor: props.anchor });

      const lineProps: JXGProperties = {
        straightFirst: false,
        straightLast: false
      };
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
