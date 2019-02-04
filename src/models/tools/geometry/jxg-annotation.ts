import { JXGChangeAgent, JXGProperties } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { assign, size } from "lodash";
import * as uuid from "uuid/v4";

export const isAnnotation = (v: any) =>
                (v instanceof JXG.Text) && (v.elType === "text") &&
                (v.getAttribute("clientType") === "annotation");

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
    return (board as JXG.Board).create("text", [0, -1, "annotation"], props);
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
