import { Point } from "../../utilities/math-utils";
import { ObjectBoundingBox } from "./clue-object";

export function boundDelta(delta: number, boundingSize?: number) {
  if (boundingSize === undefined) return delta;
  const halfBoundingSize = boundingSize / 2;
  return Math.max(-halfBoundingSize, Math.min(halfBoundingSize, delta));
}

export function boundingBoxCenter(bb: ObjectBoundingBox): Point {
  return [ bb.left + bb.width / 2, bb.top + bb.height / 2 ];
}
