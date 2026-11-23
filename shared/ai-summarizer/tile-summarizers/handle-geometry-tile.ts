/**
 * Describes a geometry object an annotation is anchored to. The geometry tile has no summarizer of
 * its own -- its content reaches the generic tile description, which strips ids -- so these phrases
 * have to stand alone: coordinates, not ids, wherever the student has not named the object.
 */
import { AnnotationDescriberParams } from "../ai-summarizer-types";

export function describeGeometryObject(
  { tile, objectId, objectType, dataSets }: AnnotationDescriberParams
): string | undefined {
  const objects = tile?.content?.objects ?? {};

  if (objectType === "linkedPoint") {
    // A linked point's id is `caseId:attrId` -- the table's row and column, plotted.
    const [caseId, attributeId] = objectId.split(":");
    const dataSet = dataSets.find(ds => ds.caseIds?.includes(caseId));
    const rowIndex = dataSet?.caseIds?.indexOf(caseId) ?? -1;
    const attribute = dataSet?.attributes.find(attr => attr.id === attributeId);
    if (!attribute || rowIndex < 0) { return undefined; }
    return `the point from row ${rowIndex + 1} of ${attribute.name} (${attribute.values[rowIndex]})`;
  }

  if (objectType === "segment") {
    // A segment is not stored: it is derived from the polygon it belongs to, and its id is the two
    // point ids joined by `::`. So the points are what there is to name it by.
    const [from, to] = objectId.split("::");
    const p1 = objects[from];
    const p2 = objects[to];
    return p1 && p2 ? `the segment from ${coords(p1)} to ${coords(p2)}` : undefined;
  }

  const object = objects[objectId];
  if (!object) { return undefined; }

  switch (object.type) {
    case "point":
      return object.name
        ? `point ${object.name} at ${coords(object)}`
        : `the point at ${coords(object)}`;
    case "polygon": {
      const vertices = object.points?.length ?? 0;
      const named = object.name ? `polygon ${object.name}` : "the polygon";
      return `${named} with ${vertices} ${vertices === 1 ? "vertex" : "vertices"}`;
    }
    case "line": {
      const p1 = objects[object.point1];
      const p2 = objects[object.point2];
      return p1 && p2 ? `the line through ${coords(p1)} and ${coords(p2)}` : "the line";
    }
    default:
      return `${object.type ?? objectType ?? "object"} ${objectId}`;
  }
}

function coords(point: any): string {
  return `(${point?.x ?? "?"}, ${point?.y ?? "?"})`;
}
