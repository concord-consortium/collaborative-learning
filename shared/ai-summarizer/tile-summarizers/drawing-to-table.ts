import { absoluteChildBoundingBox, BoundingBox } from "../../drawing/drawing-geometry";
import { boundingBoxForSnapshot, DrawingObjectSnapshot } from "../../drawing/drawing-object-snapshot";
import { generateMarkdownTable, pluralize } from "../ai-summarizer-utils";

const kEmptyDrawing = "This tile contains a drawing.";
const kHeaders = ["id", "type", "position", "size", "parent", "details"];

/** Round to a tenth: un-normalizing a grouped child's box produces long floats. */
function round(n: number): string {
  return `${Math.round(n * 10) / 10}`;
}

function formatPosition(bb: BoundingBox): string {
  return `${round(bb.nw.x)}, ${round(bb.nw.y)}`;
}

function formatSize(bb: BoundingBox): string {
  return `${round(bb.se.x - bb.nw.x)} x ${round(bb.se.y - bb.nw.y)}`;
}

// Everything type-specific rides here as key=value pairs rather than earning a column, the way
// Dataflow node properties do. The uniform columns are what make two rows comparable; this is where
// the differences go.
function formatDetails(o: DrawingObjectSnapshot): string {
  const details: string[] = [];
  if (o.type === "ellipse") details.push(`rx=${o.rx} ry=${o.ry}`);
  if (o.type === "vector") details.push(`dx=${o.dx} dy=${o.dy}`);
  if (o.type === "line") details.push(`points=${(o.deltaPoints?.length ?? 0) + 1}`);
  if (o.type === "group") {
    const count = o.objects?.length ?? 0;
    details.push(`${count} ${pluralize(count, "object", "objects")}`);
  }
  if (o.text !== undefined) details.push(`text="${o.text}"`);
  if (o.url !== undefined) details.push(`url=${o.url}`);
  if (o.variableId !== undefined) details.push(`variableId=${o.variableId}`);
  if (o.fill !== undefined) details.push(`fill=${o.fill}`);
  if (o.stroke !== undefined) details.push(`stroke=${o.stroke}`);
  if (o.strokeWidth !== undefined) details.push(`strokeWidth=${o.strokeWidth}`);
  if (o.strokeDashArray) details.push(`strokeDashArray=${o.strokeDashArray}`);
  if (o.rotation) details.push(`rotation=${o.rotation}`);
  if (o.hFlip) details.push("hFlip=true");
  if (o.vFlip) details.push("vFlip=true");
  // Hidden objects are listed, not omitted: the object is still in the document and its id is still
  // resolvable. Whether a consumer may point a student at one is a prompt decision, not ours.
  if (o.visible === false) details.push("visible=false");
  return details.join(" ");
}

function row(o: DrawingObjectSnapshot, bb: BoundingBox, parentId: string): string[] {
  return [o.id, o.type, formatPosition(bb), formatSize(bb), parentId, formatDetails(o)];
}

// A group's members are stored as fractions of the group's box rather than as coordinates, so each
// child's box is converted through the group it sits in — and through every enclosing group above
// that — leaving every row in one coordinate system. absoluteChildBoundingBox is the same function
// GroupObject.adjustInternalBoundingBox uses, so flips and rotation are handled identically here.
function walk(
  objects: DrawingObjectSnapshot[], rows: string[][], parentId: string,
  parent?: { boundingBox: BoundingBox, rotation?: number, hFlip?: boolean, vFlip?: boolean }
): void {
  objects.forEach(o => {
    const storedBB = boundingBoxForSnapshot(o);
    const bb = parent ? absoluteChildBoundingBox(storedBB, parent) : storedBB;
    rows.push(row(o, bb, parentId));
    if (o.objects?.length) {
      walk(o.objects, rows, o.id,
        { boundingBox: bb, rotation: o.rotation, hFlip: o.hFlip, vFlip: o.vFlip });
    }
  });
}

/**
 * Describe a drawing tile's contents as a table, one row per object, so that anything reading the
 * summary can name a specific shape by the id the document stores.
 */
export function drawingToTable(content: { objects?: DrawingObjectSnapshot[] }): string {
  const objects = content.objects ?? [];
  if (objects.length === 0) return kEmptyDrawing;

  const rows: string[][] = [];
  walk(objects, rows, "");

  const count = rows.length;
  const preamble =
    `This tile contains a drawing with ${count} ${pluralize(count, "object", "objects")}, ` +
    `listed back to front.\n\n`;
  return preamble + generateMarkdownTable(kHeaders, rows);
}
