
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
