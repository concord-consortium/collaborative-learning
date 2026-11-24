/**
 * The geometry tile has no summarizer of its own -- its content reaches the generic tile
 * description, which strips ids -- so these phrases have to stand alone: coordinates, not ids,
 * wherever the student has not named the object.
 */
import { AnnotationDescriberParams, NormalizedDataSet } from "../ai-summarizer-types";

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
    const p1 = pointCoords(from, objects, dataSets);
    const p2 = pointCoords(to, objects, dataSets);
    return p1 && p2 ? `the segment from ${p1} to ${p2}` : undefined;
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
      const p1 = pointCoords(object.point1, objects, dataSets);
      const p2 = pointCoords(object.point2, objects, dataSets);
      return p1 && p2 ? `the line through ${p1} and ${p2}` : "the line";
    }
    default:
      return `${object.type ?? objectType ?? "object"} ${objectId}`;
  }
}

/**
 * A polygon or line can join a point the tile never stored: a linked table point, whose id is
 * `caseId:attrId` and whose position the tile computes from the data set. The client plots it with
 * x from the data set's first attribute and y from the attribute in the id, so that is what names
 * it here. Looking only in `objects` would report every such segment deleted.
 */
function pointCoords(pointId: string, objects: any, dataSets: NormalizedDataSet[]): string | undefined {
  const stored = objects?.[pointId];
  if (stored) { return coords(stored); }

  const [caseId, attributeId] = (pointId ?? "").split(":");
  const dataSet = dataSets.find(ds => ds.caseIds?.includes(caseId));
  const rowIndex = dataSet?.caseIds?.indexOf(caseId) ?? -1;
  if (!dataSet || rowIndex < 0) { return undefined; }
  const yAttribute = dataSet.attributes.find(attr => attr.id === attributeId);
  const xValue = dataSet.attributes[0]?.values[rowIndex];
  if (!yAttribute || xValue === undefined) { return undefined; }
  return `(${xValue}, ${yAttribute.values[rowIndex]})`;
}

function coords(point: any): string {
  return `(${point?.x ?? "?"}, ${point?.y ?? "?"})`;
}
