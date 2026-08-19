/**
 * A text description of a Drawing tile's geometry.
 *
 * The default handler says only "This tile contains a drawing", which tells a model nothing about
 * what the student drew. The other alternative, `documentSummarizerWithDrawings`, renders real SVG
 * — but it imports `src/plugins/drawing`, which pulls in `.svg` assets that only a bundler can load,
 * so it cannot run in a Firebase function or under `tsx`. This one is pure: it reads the tile's
 * content snapshot and nothing else, so it runs everywhere the summarizer does.
 *
 * It describes and does not interpret. "A rectangle at (10, 10), 120×60" is a fact about the
 * snapshot; "a robot arm" is a reading of the picture, and the model is the thing being measured on
 * its ability to do that. Ordering follows the objects array, so the same document always produces
 * the same text.
 *
 * This is a measurement prototype, not a good description — the point is to have an honest baseline
 * that a better serializer can be compared against and beat.
 */
import { TileHandlerParams } from "../ai-summarizer-types";

interface DrawingObjectSnapshot {
  type?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  rx?: unknown;
  ry?: unknown;
  dx?: unknown;
  dy?: unknown;
  text?: unknown;
  deltaPoints?: unknown;
  objects?: unknown;
}

const isFinite_ = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Rounded to whole pixels: sub-pixel precision is drag noise, not something a reader needs. */
const round = (value: number): string => String(Math.round(value));

function describeSize(object: DrawingObjectSnapshot): string {
  if (isFinite_(object.width) && isFinite_(object.height)) {
    return `, ${round(object.width)}×${round(object.height)}`;
  }
  // An ellipse carries radii rather than a bounding box.
  if (isFinite_(object.rx) && isFinite_(object.ry)) {
    return `, radii ${round(object.rx)}×${round(object.ry)}`;
  }
  // A vector is a displacement from its own origin.
  if (isFinite_(object.dx) && isFinite_(object.dy)) {
    return `, ${round(object.dx)}×${round(object.dy)} from its start`;
  }
  if (Array.isArray(object.deltaPoints)) {
    // +1: the points are deltas *after* the object's own origin, which is the first vertex.
    return `, ${object.deltaPoints.length + 1} points`;
  }
  return "";
}

function describeObject(object: DrawingObjectSnapshot): string {
  const type = typeof object.type === "string" && object.type.length > 0 ? object.type : "object";
  const at = isFinite_(object.x) && isFinite_(object.y)
    ? ` at (${round(object.x)}, ${round(object.y)})`
    : "";
  // Quoted so an empty string, or one with punctuation, reads as content rather than as prose.
  const text = typeof object.text === "string" && object.text.length > 0
    ? `: ${JSON.stringify(object.text)}`
    : "";
  const group = Array.isArray(object.objects)
    ? ` containing ${object.objects.length} ${object.objects.length === 1 ? "object" : "objects"}`
    : "";
  return `- ${type}${at}${describeSize(object)}${group}${text}`;
}

/** "2 rectangles, 1 text", in first-appearance order so the same drawing always reads the same. */
function countsByType(objects: DrawingObjectSnapshot[]): string {
  const counts = new Map<string, number>();
  for (const object of objects) {
    const type = typeof object.type === "string" && object.type.length > 0 ? object.type : "object";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts].map(([type, count]) => `${count} ${type}${count === 1 ? "" : "s"}`).join(", ");
}

export function handleDrawingTileText({ tile }: TileHandlerParams): string | undefined {
  const content = tile.model.content as { type?: string; objects?: unknown };
  if (content.type !== "Drawing") return undefined;

  const objects = (Array.isArray(content.objects) ? content.objects : []) as DrawingObjectSnapshot[];
  if (objects.length === 0) return "This tile contains a drawing, which is empty.";

  const objectWord = objects.length === 1 ? "object" : "objects";
  return `This tile contains a drawing with ${objects.length} ${objectWord} ` +
    `(${countsByType(objects)}). Each object's type, position and size are listed below; ` +
    "positions are in the drawing's own coordinates.\n\n" +
    objects.map(describeObject).join("\n");
}
