import { castArray, each, values } from "lodash";
import JXG from "jsxgraph";
import { getObjectById } from "./jxg-board";
import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { getPointsForVertexAngle } from "./jxg-polygon";
import { isPoint, isPolygon, isVertexAngle } from "./jxg-types";
import { uniqueId } from "../../../utilities/js-utils";

export const canSupportVertexAngle = (vertex: JXG.Point): boolean => {
  const children = values(vertex.childElements);
  const polygons = children.filter(isPolygon);
  const polygon = polygons.length === 1 ? polygons[0] : undefined;
  return !!polygon && (polygon.vertices.length > 3);
};

export const getVertexAngle = (vertex: JXG.Point | undefined): JXG.Angle | undefined => {
  if (!vertex) return undefined;
  let vertexAngle: JXG.Angle | undefined;
  each(vertex.childElements, child => {
    if (isVertexAngle(child)) {
      const childAngle = child;
      if (childAngle.point1.id === vertex.id) {
        vertexAngle = childAngle;
      }
    }
  });
  return vertexAngle;
};

export const updateVertexAngle = (angle: JXG.Angle) => {
  const centerPt = angle.point1;
  const parents = isPoint(centerPt) && getPointsForVertexAngle(centerPt);
  // reverse the order of parents if necessary to guarantee that we
  // mark the correct side of the angle.
  if (parents && (parents[0].id === angle.point3.id) && (parents[2].id === angle.point2.id)) {
    const swap = angle.parents[1];
    angle.parents[1] = angle.parents[2];
    angle.parents[2] = swap;
    // cf. JXG.createAngle()
    angle.point = angle.point2 = angle.radiuspoint = parents[0];
    angle.pointsquare = angle.point3 = angle.anglepoint = parents[2];
    angle.updateDataArray();
  }
};

export function updateVertexAnglesFromObjects(objects: JXG.GeometryElement[]) {
  const affectedAngles: { [id: string]: JXG.Angle } = {};

  // identify affected angles
  each(objects, (obj, id) => {
    if (isPoint(obj)) {
      each(obj.childElements, child => {
        if (isVertexAngle(child)) {
          affectedAngles[child.id] = child;
        }
      });
    }
  });

  // update affected angles
  let board: JXG.Board | undefined;
  each(affectedAngles, angle => {
    board = angle.board;
    updateVertexAngle(angle);
  });
  board?.update();
}

export const vertexAngleChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const _board = board as JXG.Board;
    const parents = (change.parents || [])
                      .map(id => getObjectById(_board, id as string))
                      .filter(pt => pt != null);
    // cf. http://jsxgraph.uni-bayreuth.de/wiki/index.php/Positioning_of_labels
    const overrides: any = { name() { return `${this.Value ? JXG.toFixed(this.Value() * 180 / Math.PI, 0) : ""}°`; },
                              clientType: "vertexAngle" };
    const props = { id: uniqueId(), radius: 1, ...change.properties, ...overrides };
    return parents.length === 3 ? _board.create("angle", parents, props) : undefined;
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  delete: (board, change) => {
    const ids = castArray(change.targetID);

    // Identify dots used to define the angle, which would otherwise
    // get orphaned when deleting the angle.
    const dotIds: string[] = [];
    ids.forEach(id => {
      const obj = getObjectById(board, id);
      if (isVertexAngle(obj)) {
        const angle = obj;
        if (isPoint(angle.dot)) {
          dotIds.push(angle.dot.id);
        }
      }
    });

    // add the dot IDs to the list of objects to delete
    const { targetID, ...others } = change;
    const _change = { targetID: [...ids, ...dotIds], ...others };
    objectChangeAgent.delete(board, _change);
  }
};
