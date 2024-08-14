import { CircleAttributes } from "jsxgraph";
import { uniqueId } from "../../../utilities/js-utils";
import { fillPropsForColorScheme, strokePropsForColorScheme } from "./geometry-utils";
import { JXGChangeAgent, JXGProperties } from "./jxg-changes";
import { isCircle } from "./jxg-types";
import { objectChangeAgent } from "./jxg-object";


const defaultCircleProps = Object.freeze({
  hasInnerPoints: true,
  fillOpacity: .2,       highlightFillOpacity: .25,
  strokeWidth: 2.5,      highlightStrokeWidth: 2.5,
  strokeOpacity: 1,      highlightStrokeOpacity: 0.99, // 0.99 triggers shadow
});

const selectedCircleProps = Object.freeze({
  fillOpacity: .3,       highlightFillOpacity: .3
});


export function getCircleVisualProps(selected: boolean, colorScheme: number) {
  const selectedProps = selected ? selectedCircleProps : [];
  const props: CircleAttributes = {
    ...defaultCircleProps,
    ...selectedProps,
    ...fillPropsForColorScheme(colorScheme),
    ...strokePropsForColorScheme(colorScheme)
  };

  return props;
}

export function createCircle(board: JXG.Board, points: string[], properties: JXGProperties) {
  const colorScheme = properties.colorScheme || 0;
  const id = properties.id || uniqueId();
  const props = {
    ...properties,
    id,
    ...getCircleVisualProps(false, colorScheme),
  };
  const circle = board.create("circle", points, {...props, visible: true});
  return isCircle(circle) ? circle : undefined;
}

export const circleChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const parents: any = change.parents;
    if (Array.isArray(parents) && parents.length === 2 && change.properties && !Array.isArray(change.properties)) {
      return createCircle(board as JXG.Board, parents, change.properties);
    } else {
      console.warn("Invalid change for circle creation:", change);
    }
  },

  update: objectChangeAgent.update,

  delete: objectChangeAgent.delete
};
