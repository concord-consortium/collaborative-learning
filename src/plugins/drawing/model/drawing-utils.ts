/**
 * Recursively removes 'id' attributes from a drawing object snapshot and all nested objects in 'objects' arrays.
 * @param obj The snapshot object to process
 * @returns A new object with all 'id' attributes removed
 */
export function removeIdsFromSnapshot(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeIdsFromSnapshot);
  }
  if (obj && typeof obj === 'object') {
    // Remove 'id' from the current object
    const { id, ...rest } = obj;
    // If there is an 'objects' array, recurse into it
    if (Array.isArray(rest.objects)) {
      rest.objects = rest.objects.map(removeIdsFromSnapshot);
    }
    return rest;
  }
  // Primitive value, return as is
  return obj;
}

/**
 * Rotates a point around a center by a given angle in degrees (clockwise).
 * @param point The point to rotate {x, y}
 * @param center The center of rotation {x, y}
 * @param angleDegrees The angle in degrees (clockwise)
 * @returns The rotated point {x, y}
 */
export function rotatePoint(point: {x: number, y: number}, center: {x: number, y: number}, angleDegrees: number) {
  const angleRad = angleDegrees * Math.PI / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}
