import { uniqueId } from "../../../utilities/js-utils";
import { strokePropsForColorScheme } from "./geometry-utils";
import { ELabelOption, JXGChangeAgent, JXGProperties } from "./jxg-changes";
import { getObjectById } from "./jxg-board";
import { isInfiniteLine, kInfiniteLineType } from "./jxg-types";
import { objectChangeAgent } from "./jxg-object";

const defaultLineProps = Object.freeze({
  strokeWidth: 2.5,      highlightStrokeWidth: 2.5,
  strokeOpacity: 1,      highlightStrokeOpacity: 0.99,
  straightFirst: true,
  straightLast: true,
  firstArrow: true,
  lastArrow: true,
});

const selectedLineProps = Object.freeze({
  strokeOpacity: 0.99    // 0.99 triggers CSS drop-shadow filter for selection feedback
});

export function getLineVisualProps(selected: boolean, colorScheme: number) {
  const selectedProps = selected ? selectedLineProps : {};
  return {
    ...defaultLineProps,
    ...selectedProps,
    ...strokePropsForColorScheme(colorScheme),
  };
}

export function getInfiniteLine(board: JXG.Board, id: string): JXG.Line | undefined {
  const obj = getObjectById(board, id);
  return isInfiniteLine(obj) ? obj : undefined;
}

export function setPropertiesForLineLabelOption(line: JXG.Line) {
  const labelOption = line.getAttribute("clientLabelOption") || ELabelOption.kNone;
  switch (labelOption) {
    case ELabelOption.kLabel:
      // Override getLabelAnchor so the label appears at the midpoint of the two
      // defining points rather than at the board edge (JSXGraph's default for
      // infinite lines, which clips to the bounding box).
      (line as any).getLabelAnchor = function() {
        const c1 = this.point1.coords.usrCoords;
        const c2 = this.point2.coords.usrCoords;
        return new JXG.Coords(JXG.COORDS_BY_USER,
          [(c1[1] + c2[1]) / 2, (c1[2] + c2[2]) / 2],
          this.board
        );
      };
      line.setAttribute({
        withLabel: true,
        name: line.getAttribute("clientName")
      });
      if (line.label) {
        line.label.setAttribute({ anchorX: "middle", offset: [0, 12] } as any);
      }
      break;
    default:
      line.setAttribute({
        withLabel: false
      });
  }
}

export function createLine(board: JXG.Board, points: string[], properties: JXGProperties) {
  const colorScheme = properties.colorScheme || 0;
  const id = properties.id || uniqueId();
  const props = {
    ...properties,
    id,
    clientType: kInfiniteLineType,
    ...getLineVisualProps(false, colorScheme),
  };
  const line = board.create("line", points, { ...props, visible: true });
  if (isInfiniteLine(line)) {
    // JSXGraph lines are not draggable by default (unlike circles/polygons).
    // Enable dragging so the line can be selected and moved as a whole.
    line.isDraggable = true;
    setPropertiesForLineLabelOption(line);
  }
  return isInfiniteLine(line) ? line : undefined;
}

export const lineChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const parents: any = change.parents;
    if (Array.isArray(parents) && parents.length === 2 && change.properties && !Array.isArray(change.properties)) {
      return createLine(board as JXG.Board, parents, change.properties);
    } else {
      console.warn("Invalid change for line creation:", change);
    }
  },

  update: (board, change) => {
    // labelOption update — apply line-specific label properties
    if (change.targetID && !Array.isArray(change.targetID) &&
        !Array.isArray(change.properties) && change.properties?.labelOption) {
      const line = getInfiniteLine(board as JXG.Board, change.targetID);
      if (line) {
        line._set("clientLabelOption", change.properties.labelOption);
        line._set("clientName", change.properties.clientName);
        setPropertiesForLineLabelOption(line);
      }
      return;
    }
    // other updates can be handled generically
    return objectChangeAgent.update(board, change);
  },

  delete: objectChangeAgent.delete
};
