export function boundDelta(delta: number, boundingSize?: number) {
  if (boundingSize === undefined) return delta;
  const halfBoundingSize = boundingSize / 2;
  return Math.max(-halfBoundingSize, Math.min(halfBoundingSize, delta));
}
