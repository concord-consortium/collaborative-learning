/*
Describes a drawing tile as a table so that anything reading the summary can name a specific shape
by the id the document stores.

A drawing with two loose shapes, a variable chip, a group of two, and one hidden object serializes
to this — see the "matches the documented example" test, which pins it:

    This tile contains a drawing with 7 objects, listed back to front. Position, size and orientation
    are in the tile's coordinate space, including for objects inside a group.

    | id | type | position | size | orientation | parent | details |
    | --- | --- | --- | --- | --- | --- | --- |
    | a7Kd2 | rectangle | 40, 20 | 120 x 80 |  |  | fill=#0069ff stroke=#000000 strokeWidth=2 |
    | c3Mn8 | ellipse | 170, 70 | 60 x 60 |  |  | rx=30 ry=30 fill=none stroke=#d10000 |
    | Dp47z | variable | 320, 40 | 75 x 24 |  |  | variableId=v_speed estimatedSize |
    | Bq91x | group | 100, 200 | 200 x 100 |  |  | 2 objects |
    | kid1 | rectangle | 100, 200 | 100 x 50 |  | Bq91x | fill=#00b400 |
    | kid2 | vector | 200, 250 | 100 x 50 |  | Bq91x | dx=100 dy=50 stroke=#000000 |
    | t9Qr4 | text | 130, 250 | 20 x 90 | 90° |  | text="too fast" visible=false |

Some things in that output are not obvious from the code:

- `position` and `size` describe the object's bounding box, not its stored fields. The ellipse above
  stores its centre at 200,100 with radii of 30 but reports 170,70. Every row therefore means the
  same thing, which is what lets a reader compare two of them.
- The box is the *turned* one where an object is rotated, as it is on screen: `t9Qr4` stores 90 x 20
  and reports 20 x 90. That is why orientation is a column rather than an entry in `details` — once
  the box is turned, position and size can no longer express it, a 100x50 rectangle turned 90
  degrees being indistinguishable from an unturned 50x100 one. Mirroring shares the column for the
  stronger version of the same reason: a mirrored object has exactly the box of an unmirrored one,
  so nothing else in the row could carry it. A cell reads `90°`, `mirrored`, `90° mirrored`, or is
  empty.
- Orientation is measured against the tile and composed through every enclosing group, so the whole
  column agrees with the position and size beside it. An object turned 90 inside a group turned 270
  reports nothing, because upright is how it sits on the page; an object flipped inside a group
  flipped the same way reports nothing either. This is why an object's own `hFlip`/`vFlip` are not
  in `details`: they are stored relative to its parent, and mixing them with a tile-space angle
  would put two frames in one row. Note also that a group scales its members by its own width and
  height, so a member turned by something other than a multiple of 90 inside a group that is not
  square is sheared rather than merely turned, and no single angle describes it. Only authored or
  imported documents can reach that — the Rotate control turns in quarters.
- Row order is the order the objects are stored in, which is back to front. The preamble says so,
  because otherwise the ordering is information the model cannot see.
- A group's members follow it and name it in `parent`, with coordinates converted out of the group's
  normalized space into the tile's. `kid1` is stored as `x: 0, width: 0.5`. The preamble says this
  too: `parent` otherwise invites the usual reading, where nested coordinates are group-relative.
- Hidden objects appear, marked `visible=false`, rather than being dropped. They are still in the
  document and their ids still resolve; whether a consumer may point a student at one is a prompt
  decision rather than a serializer decision.
- A variable chip carries `estimatedSize`, because its size is the only one here that was not
  computed. The chip measures itself on render and that measurement is volatile, so a snapshot only
  ever has the defaults, and the real width follows the length of the variable's name.

An empty drawing returns the bare sentence this file replaced, so documents whose drawing tiles have
no objects summarize exactly as they did before.
*/

import {
  absoluteChildPoint, BoundingBox, boundingBoxCorners, boundingBoxForPoints, ellipseBoundingBox,
  GroupTransform, kVariableChipDefaultHeight, kVariableChipDefaultWidth, Point, rotatePoint,
  sizedBoundingBox
} from "../../drawing/drawing-geometry";
import {
  boundingBoxForSnapshot, DrawingObjectSnapshot, isLegacyGroup
} from "../../drawing/drawing-object-snapshot";
import { generateMarkdownTable, pluralize } from "../ai-summarizer-utils";

const kEmptyDrawing = "This tile contains a drawing.";
const kHeaders = ["id", "type", "position", "size", "orientation", "parent", "details"];

/** A chip's box: its origin wherever the group chain put it, plus the fixed default extent. */
function chipBoundingBox(origin: Point): BoundingBox {
  return sizedBoundingBox({
    x: origin.x, y: origin.y,
    width: kVariableChipDefaultWidth, height: kVariableChipDefaultHeight
  });
}

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
/**
 * An object's defining geometry, in the tile's coordinate space rather than the space it is stored
 * in. A group's members hold these as fractions of the group, exactly as they hold their positions,
 * so emitting them raw would put two coordinate systems in one row — `rx=0.25` beside a size of
 * 50 x 50. They travel the same mapping the position and size columns do.
 */
function typeGeometry(o: DrawingObjectSnapshot, toTileSpace?: ToTileSpace): string[] {
  const map = toTileSpace ?? ((p: Point) => p);
  switch (o.type) {
    case "ellipse": {
      // Radii are half the mapped extent. Under a group turned by a multiple of 90 that is exact
      // and correctly swaps the two; at other angles the mapped box encloses the ellipse, so these
      // are the closest an axis-aligned pair can get to a turned one.
      const box = boundingBoxForPoints(boundingBoxCorners(
        ellipseBoundingBox({ x: o.x, y: o.y, rx: o.rx ?? 0, ry: o.ry ?? 0 })).map(map));
      return [`rx=${round((box.se.x - box.nw.x) / 2)} ry=${round((box.se.y - box.nw.y) / 2)}`];
    }
    case "vector": {
      // Mapping both endpoints keeps direction as well as magnitude, which matters for an arrow.
      const start = map({ x: o.x, y: o.y });
      const end = map({ x: o.x + (o.dx ?? 0), y: o.y + (o.dy ?? 0) });
      return [`dx=${round(end.x - start.x)} dy=${round(end.y - start.y)}`];
    }
    case "line":
      // A count is the same number in any coordinate system.
      return [`points=${(o.deltaPoints?.length ?? 0) + 1}`];
    case "group": {
      const count = o.objects?.length ?? 0;
      return [`${count} ${pluralize(count, "object", "objects")}`];
    }
    default:
      return [];
  }
}

function formatDetails(o: DrawingObjectSnapshot, geometry: string[]): string {
  const details: string[] = [...geometry];
  // JSON-encoded rather than just quoted: drawing text is edited in a textarea and can contain
  // newlines, which would end the table row and corrupt every column after it.
  if (o.text !== undefined) details.push(`text=${JSON.stringify(o.text)}`);
  if (o.url !== undefined) details.push(`url=${o.url}`);
  if (o.variableId !== undefined) details.push(`variableId=${o.variableId}`);
  // A chip is the one row whose size is not measured: the rendered width follows the variable's
  // name and is never persisted, so the columns carry a default. Marked so a reader can tell it
  // apart from a box that was actually computed.
  if (o.type === "variable") details.push("estimatedSize");
  if (o.fill !== undefined) details.push(`fill=${o.fill}`);
  if (o.stroke !== undefined) details.push(`stroke=${o.stroke}`);
  if (o.strokeWidth !== undefined) details.push(`strokeWidth=${o.strokeWidth}`);
  if (o.strokeDashArray) details.push(`strokeDashArray=${o.strokeDashArray}`);
  // Flips are not reported here — they are part of the orientation column, in the tile's frame.
  // Emitting the object's own stored flags alongside would put two coordinate systems in one row.
  // Hidden objects are listed, not omitted: the object is still in the document and its id is still
  // resolvable. Whether a consumer may point a student at one is a prompt decision, not ours.
  if (o.visible === false) details.push("visible=false");
  return details.join(" ");
}

/**
 * How an object is turned relative to the document, as a rotation plus whether an odd number of
 * mirrors has been applied. Mirroring matters because it reverses the direction a later rotation
 * turns: a mirror M and rotation R satisfy `M R = R⁻¹ M`.
 */
interface Orientation {
  rotation: number;
  mirrored: boolean;
}

const kUpright: Orientation = { rotation: 0, mirrored: false };

/** Apply `inner`, expressed in the frame `outer` establishes, and return the result in `outer`'s. */
function compose(outer: Orientation, inner: Orientation): Orientation {
  return {
    rotation: outer.rotation + (outer.mirrored ? -inner.rotation : inner.rotation),
    mirrored: outer.mirrored !== inner.mirrored
  };
}

// A group turns its members by its own rotation and its flips together. One flip is a mirror; both
// at once are a half turn rather than a mirror, and a vertical flip is a horizontal one plus a half
// turn — which is the form used here.
function objectOrientation(o: DrawingObjectSnapshot): Orientation {
  return {
    rotation: (o.rotation ?? 0) + (o.vFlip ? 180 : 0),
    mirrored: !!o.hFlip !== !!o.vFlip
  };
}

// Orientation earns a column because position and size cannot express it: the box reported for a
// 100x50 rectangle turned 90 degrees is 50x100, which is also what an unturned 50x100 rectangle
// reports, and a mirrored object has exactly the box of an unmirrored one.
//
// Both halves are measured against the tile, composed through every enclosing group, so the whole
// column agrees with the position and size beside it. An object turned 90 inside a group turned 270
// reports nothing, because upright is how it sits on the page; an object flipped inside a group
// flipped the same way reports nothing either, for the same reason. Rotations are not constrained
// when stored — rotateBy deliberately lets them grow past 360 — so this normalizes them.
function formatOrientation(orientation: Orientation): string {
  const degrees = ((orientation.rotation % 360) + 360) % 360;
  const parts: string[] = [];
  if (degrees) parts.push(`${degrees}°`);
  if (orientation.mirrored) parts.push("mirrored");
  return parts.join(" ");
}

function row(
  o: DrawingObjectSnapshot, bb: BoundingBox, parentId: string, orientation: Orientation,
  geometry: string[]
): string[] {
  return [
    o.id, o.type, formatPosition(bb), formatSize(bb), formatOrientation(orientation), parentId,
    formatDetails(o, geometry)
  ];
}

/**
 * Maps a point out of the space an object is stored in and into the drawing tile's own canvas
 * space. Tile rather than document: CLUE has no coordinate space spanning tiles, so a drawing's
 * coordinates mean nothing outside it.
 */
type ToTileSpace = (point: Point) => Point;

// A group's members are stored as fractions of the group's box rather than as coordinates, so each
// child is converted through the group it sits in — and through every enclosing group above that —
// leaving every row in one coordinate system. absoluteChildPoint is the same mapping
// GroupObject.adjustInternalBoundingBox applies, so flips and rotation behave identically here.
//
// Corners travel through that chain individually and become a box once, at the end. Collapsing to a
// box at each level instead would discard the rotation of every level above, putting a child of a
// group inside a rotated group in the wrong quadrant.
function walk(
  objects: DrawingObjectSnapshot[], rows: string[][], parentId: string,
  toTileSpace?: ToTileSpace, parentOrientation: Orientation = kUpright
): void {
  objects.forEach(o => {
    const localBB = boundingBoxForSnapshot(o);
    // An object's own rotation turns it about its se corner, as DrawingObject.boundingBox does.
    const corners = boundingBoxCorners(localBB)
      .map(p => o.rotation ? rotatePoint(p, localBB.se, o.rotation) : p);
    // A chip is sized in pixels rather than in whatever space it is stored in, so only its origin
    // travels the group chain; scaling its extent would report a 75 x 24 chip as 15000 x 2400. It
    // also renders without any rotation or flip transform, so it is always reported upright.
    const chip = o.type === "variable";
    const bb = chip
      ? chipBoundingBox(toTileSpace ? toTileSpace({ x: o.x, y: o.y }) : { x: o.x, y: o.y })
      : boundingBoxForPoints(toTileSpace ? corners.map(toTileSpace) : corners);
    // objectOrientation folds in the object's own flips as well as its rotation, and it is the same
    // value handed to its children as their frame — so a row and the rows beneath it are measured
    // the same way, rather than one against the tile and the other against its parent.
    const orientation = chip ? kUpright : compose(parentOrientation, objectOrientation(o));
    rows.push(row(o, bb, parentId, orientation, typeGeometry(o, toTileSpace)));

    if (o.objects?.length) {
      if (isLegacyGroup(o)) {
        // A pre-1.1.0 group's members are stored in ordinary coordinates rather than as fractions
        // of it, so there is nothing to un-normalize — converting them would be the bug, not the
        // fix. They inherit this group's frame unchanged.
        walk(o.objects, rows, o.id, toTileSpace, compose(parentOrientation, objectOrientation(o)));
      } else {
        // Members are fractions of this group's *unrotated* box, so that is the frame handed down —
        // not the rotated box just reported for it.
        const frame: GroupTransform = {
          boundingBox: localBB, rotation: o.rotation, hFlip: o.hFlip, vFlip: o.vFlip
        };
        const next: ToTileSpace = p => {
          const inParentSpace = absoluteChildPoint(p, frame);
          return toTileSpace ? toTileSpace(inParentSpace) : inParentSpace;
        };
        walk(o.objects, rows, o.id, next, compose(parentOrientation, objectOrientation(o)));
      }
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

  // Both sentences state something the table cannot show. Order is invisible without the first, and
  // the `parent` column actively invites the wrong reading of the second: nested coordinates are
  // group-relative in most conventions a reader will have met, and nothing here contradicts that.
  const count = rows.length;
  const preamble =
    `This tile contains a drawing with ${count} ${pluralize(count, "object", "objects")}, ` +
    `listed back to front. Position, size and orientation are in the tile's coordinate space, ` +
    `including for objects inside a group.\n\n`;
  return preamble + generateMarkdownTable(kHeaders, rows);
}
