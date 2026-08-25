/*
Describes a drawing tile as a table so that anything reading the summary can name a specific shape
by the id the document stores.

A drawing with two loose shapes, a variable chip, a group of two, and one hidden object serializes
to this — see the "matches the documented example" test, which pins it:

    This tile contains a drawing with 7 objects, listed back to front.

    | id | type | position | size | rotation | parent | details |
    | --- | --- | --- | --- | --- | --- | --- |
    | a7Kd2 | rectangle | 40, 20 | 120 x 80 |  |  | fill=#0069ff stroke=#000000 strokeWidth=2 |
    | c3Mn8 | ellipse | 170, 70 | 60 x 60 |  |  | rx=30 ry=30 fill=none stroke=#d10000 |
    | Dp47z | variable | 320, 40 | 75 x 24 |  |  | variableId=v_speed |
    | Bq91x | group | 100, 200 | 200 x 100 |  |  | 2 objects |
    | kid1 | rectangle | 100, 200 | 100 x 50 |  | Bq91x | fill=#00b400 |
    | kid2 | vector | 200, 250 | 100 x 50 |  | Bq91x | dx=0.5 dy=0.5 stroke=#000000 |
    | t9Qr4 | text | 130, 250 | 20 x 90 | 90° |  | text="too fast" visible=false |

Five things in that output are not obvious from the code:

- `position` and `size` describe the object's bounding box, not its stored fields. The ellipse above
  stores its centre at 200,100 with radii of 30 but reports 170,70. Every row therefore means the
  same thing, which is what lets a reader compare two of them.
- The box is the *turned* one where an object is rotated, as it is on screen: `t9Qr4` stores 90 x 20
  and reports 20 x 90. That is why rotation is a column rather than another entry in `details` —
  once the box is turned, position and size can no longer express orientation, and a 100x50
  rectangle turned 90 degrees is indistinguishable from an unturned 50x100 one. Flips stay in
  `details`, since they do not change the box.
- Row order is document order, which is back to front. The preamble says so, because otherwise the
  ordering is information the model cannot see.
- A group's members follow it and name it in `parent`, with coordinates converted out of the group's
  normalized space into the document's. `kid1` is stored as `x: 0, width: 0.5`.
- Hidden objects appear, marked `visible=false`, rather than being dropped. They are still in the
  document and their ids still resolve; whether a consumer may point a student at one is a prompt
  decision rather than a serializer decision.

An empty drawing returns the bare sentence this file replaced, so documents whose drawing tiles have
no objects summarize exactly as they did before.
*/

import {
  absoluteChildPoint, BoundingBox, boundingBoxCorners, boundingBoxForPoints, GroupTransform, Point,
  rotatePoint
} from "../../drawing/drawing-geometry";
import { boundingBoxForSnapshot, DrawingObjectSnapshot } from "../../drawing/drawing-object-snapshot";
import { generateMarkdownTable, pluralize } from "../ai-summarizer-utils";

const kEmptyDrawing = "This tile contains a drawing.";
const kHeaders = ["id", "type", "position", "size", "rotation", "parent", "details"];

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
  // JSON-encoded rather than just quoted: drawing text is edited in a textarea and can contain
  // newlines, which would end the table row and corrupt every column after it.
  if (o.text !== undefined) details.push(`text=${JSON.stringify(o.text)}`);
  if (o.url !== undefined) details.push(`url=${o.url}`);
  if (o.variableId !== undefined) details.push(`variableId=${o.variableId}`);
  if (o.fill !== undefined) details.push(`fill=${o.fill}`);
  if (o.stroke !== undefined) details.push(`stroke=${o.stroke}`);
  if (o.strokeWidth !== undefined) details.push(`strokeWidth=${o.strokeWidth}`);
  if (o.strokeDashArray) details.push(`strokeDashArray=${o.strokeDashArray}`);
  if (o.hFlip) details.push("hFlip=true");
  if (o.vFlip) details.push("vFlip=true");
  // Hidden objects are listed, not omitted: the object is still in the document and its id is still
  // resolvable. Whether a consumer may point a student at one is a prompt decision, not ours.
  if (o.visible === false) details.push("visible=false");
  return details.join(" ");
}

// Rotation earns a column rather than sitting in details, because position and size cannot express
// it: the box reported for a 100x50 rectangle turned 90 degrees is 50x100, which is also what an
// unturned 50x100 rectangle reports. Flips stay in details — they do not change the box at all.
function formatRotation(o: DrawingObjectSnapshot): string {
  return o.rotation ? `${o.rotation}°` : "";
}

function row(o: DrawingObjectSnapshot, bb: BoundingBox, parentId: string): string[] {
  return [
    o.id, o.type, formatPosition(bb), formatSize(bb), formatRotation(o), parentId, formatDetails(o)
  ];
}

/** Maps a point out of the space an object is stored in and into the document's. */
type ToDocument = (point: Point) => Point;

// A group's members are stored as fractions of the group's box rather than as coordinates, so each
// child is converted through the group it sits in — and through every enclosing group above that —
// leaving every row in one coordinate system. absoluteChildPoint is the same mapping
// GroupObject.adjustInternalBoundingBox applies, so flips and rotation behave identically here.
//
// Corners travel through that chain individually and become a box once, at the end. Collapsing to a
// box at each level instead would discard the rotation of every level above, putting a child of a
// group inside a rotated group in the wrong quadrant.
function walk(
  objects: DrawingObjectSnapshot[], rows: string[][], parentId: string, toDocument?: ToDocument
): void {
  objects.forEach(o => {
    const localBB = boundingBoxForSnapshot(o);
    // An object's own rotation turns it about its se corner, as DrawingObject.boundingBox does.
    const corners = boundingBoxCorners(localBB)
      .map(p => o.rotation ? rotatePoint(p, localBB.se, o.rotation) : p);
    rows.push(row(o, boundingBoxForPoints(toDocument ? corners.map(toDocument) : corners), parentId));

    if (o.objects?.length) {
      // Members are fractions of this group's *unrotated* box, so that is the frame handed down —
      // not the rotated box just reported for it.
      const frame: GroupTransform = {
        boundingBox: localBB, rotation: o.rotation, hFlip: o.hFlip, vFlip: o.vFlip
      };
      const next: ToDocument = p => {
        const inParentSpace = absoluteChildPoint(p, frame);
        return toDocument ? toDocument(inParentSpace) : inParentSpace;
      };
      walk(o.objects, rows, o.id, next);
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
