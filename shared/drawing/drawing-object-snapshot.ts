import {
  BoundingBox, computeObjectsBoundingBox, ellipseBoundingBox, kVariableChipDefaultHeight,
  kVariableChipDefaultWidth, lineBoundingBox, sizedBoundingBox, vectorBoundingBox
} from "./drawing-geometry";

// The stored shape of a drawing object, as a snapshot-only reader sees it. Declared structurally
// rather than derived from the MST models in src/plugins/drawing/objects/, because those import
// React and cannot be loaded in Firebase functions. Keep the optional fields in step with them.
export interface DrawingObjectSnapshot {
  id: string;
  type: string;
  x: number;
  y: number;
  visible?: boolean;
  rotation?: number;
  hFlip?: boolean;
  vFlip?: boolean;
  width?: number;                              // rectangle, text, image, group
  height?: number;
  rx?: number;                                 // ellipse
  ry?: number;
  dx?: number;                                 // vector
  dy?: number;
  deltaPoints?: { dx: number, dy: number }[];  // line
  headShape?: string;                          // vector
  tailShape?: string;
  objects?: DrawingObjectSnapshot[];           // group
  objectExtents?: Record<string, unknown>;     // group, pre-1.1.0 only
  text?: string;
  url?: string;
  filename?: string;
  variableId?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  strokeDashArray?: string;
}

/**
 * Whether a group predates the v1.1.0 drawing format.
 *
 * Groups gained `width`/`height` in v1.1.0, and only from then on were their members stored as
 * fractions of the group. Before that a group carried `objectExtents` and its members held ordinary
 * absolute coordinates. This is the migrator's own test for that shape, kept deliberately identical
 * to it.
 *
 * Who actually meets the old shape, since `DrawingMigrator` converts it whenever a browser builds a
 * model: only readers that never build one. The Cloud Functions that summarize a document read the
 * stored content straight out of the realtime database, so they are handed whatever the client last
 * wrote. The chat tutor is *not* affected — it summarizes a live MST node in the browser, which has
 * always been migrated.
 *
 * The exposure is therefore historical analysis rather than anything a student sees: drawing groups
 * shipped in 2023-08 and the normalizing migration in 2025-05, so a document with a grouped drawing
 * that has not been re-saved since then is still stored this way. Without this check every one of
 * its members summarizes as a zero-size point at the group's origin, silently — nothing throws, the
 * analysis simply describes a drawing that is not there.
 */
/**
 * What the drawing tile's own object panel calls this shape, or undefined when that is just the
 * type again.
 *
 * Two of these are actively misleading if a reader assumes the type name is what the student sees:
 * `line` is labelled Freehand, and `vector` is labelled Line. Citing "the line" by type would point
 * at the wrong object. Mirrors the `label` getters on the object models, which this module cannot
 * import.
 */
export function displayLabel(o: DrawingObjectSnapshot, box: BoundingBox): string | undefined {
  // Square and Circle are decided from the box as rendered, not from the stored fields. A group's
  // member stored 0.5 x 0.5 looks square in the snapshot and is not: inside a 200 x 100 group it
  // renders 100 x 50. The panel labels what the student sees, so this has to as well.
  const square = box.se.x - box.nw.x === box.se.y - box.nw.y;
  switch (o.type) {
    case "line": return "Freehand";
    case "vector": return o.headShape || o.tailShape ? "Arrow" : "Line";
    case "ellipse": return square ? "Circle" : undefined;
    case "rectangle": return square ? "Square" : undefined;
    default: return undefined;
  }
}

export function isLegacyGroup(o: DrawingObjectSnapshot): boolean {
  return o.type === "group" && (o.width == null || o.objectExtents !== undefined);
}

/**
 * The object's box in the coordinate system it is stored in — which for a member of a v1.1.0 group
 * is that group's normalized space, not the tile's. See absoluteChildBoundingBox for the conversion.
 */
export function boundingBoxForSnapshot(o: DrawingObjectSnapshot): BoundingBox {
  switch (o.type) {
    case "group":
      // A legacy group states no size of its own; it is the extent of its members, which is what
      // assimilateObjects derives when the browser loads one.
      if (isLegacyGroup(o)) {
        return computeObjectsBoundingBox(
          (o.objects ?? []).map(child => ({ boundingBox: boundingBoxForSnapshot(child) }))
        );
      }
      return sizedBoundingBox({ x: o.x, y: o.y, width: o.width ?? 0, height: o.height ?? 0 });
    case "rectangle":
    case "text":
    case "image":
      return sizedBoundingBox({ x: o.x, y: o.y, width: o.width ?? 0, height: o.height ?? 0 });
    case "ellipse":
      return ellipseBoundingBox({ x: o.x, y: o.y, rx: o.rx ?? 0, ry: o.ry ?? 0 });
    case "vector":
      return vectorBoundingBox({ x: o.x, y: o.y, dx: o.dx ?? 0, dy: o.dy ?? 0 });
    case "line":
      return lineBoundingBox({ x: o.x, y: o.y, deltaPoints: o.deltaPoints ?? [] });
    case "variable":
      // These defaults are a floor, not a measurement. The live chip re-measures itself on render
      // and calls setRenderedSize, so its real width tracks the length of the variable's name — and
      // that measurement is volatile, so it never reaches a snapshot. Callers presenting this to a
      // reader should say it is estimated; drawing-to-table marks the row.
      //
      // A chip inside a group is reachable, so callers must not scale this extent by the group.
      // Grouping a chip does throw — VariableChipObject implements neither resizeObject nor
      // setUnrotatedDragBounds, and GroupObject.assimilateObjects calls both — but the throw comes
      // *after* createGroup has detached the selection into the group, so the group survives with
      // the chip inside it and gets stored that way. drawing-to-table maps only a chip's origin
      // through the group chain for this reason.
      return sizedBoundingBox({
        x: o.x, y: o.y, width: kVariableChipDefaultWidth, height: kVariableChipDefaultHeight
      });
    default:
      // Drawing object types are plugin-registered, so this will eventually meet one it does not
      // know. A point at the object's origin keeps it addressable — it still gets a row and an id —
      // without inventing an extent.
      return sizedBoundingBox({ x: o.x, y: o.y, width: 0, height: 0 });
  }
}
