import { GeometryContentModelType } from "../../../models/tiles/geometry/geometry-content";
import { GeometryTileMode } from "./geometry-types";

/**
 * Seeds a unit-sized shape at user-coords (1, 1) for keyboard activation of a
 * toolbar mode button — replays the same `addPhantomPoint` + `realizePhantomPoint`
 * sequence the click handler uses. Returns the JXG elements created so the caller
 * can pass them to handleCreateElements for aria decoration.
 */
export function seedShapeForMode(
  board: JXG.Board,
  content: GeometryContentModelType,
  mode: GeometryTileMode,
): JXG.GeometryElement[] {
  const created: JXG.GeometryElement[] = [];

  if (mode === "select") return created;

  if (mode === "points") {
    content.addPhantomPoint(board, [1, 1]);
    const { point } = content.realizePhantomPoint(board, [1, 1], "select");
    if (point) created.push(point);
    content.clearPhantomPoint(board);
    return created;
  }

  if (mode === "polygon") {
    content.addPhantomPoint(board, [1, 1]);
    const r1 = content.realizePhantomPoint(board, [1, 1], "polygon");
    const r2 = content.realizePhantomPoint(board, [2, 1], "polygon");
    const r3 = content.realizePhantomPoint(board, [2, 2], "polygon");
    const r4 = content.realizePhantomPoint(board, [1, 2], "polygon");
    if (r1.polygon) created.push(r1.polygon);
    [r1.point, r2.point, r3.point, r4.point].forEach(p => { if (p) created.push(p); });
    if (r1.point) content.closeActivePolygon(board, r1.point);
    content.clearPhantomPoint(board);
    content.clearActivePolygon(board);
    return created;
  }

  if (mode === "circle") {
    content.addPhantomPoint(board, [1, 1]);
    const r1 = content.realizePhantomPoint(board, [1, 1], "circle");
    const r2 = content.realizePhantomPoint(board, [2, 1], "circle");
    if (r1.circle) created.push(r1.circle);
    [r1.point, r2.point].forEach(p => { if (p) created.push(p); });
    content.clearPhantomPoint(board);
    return created;
  }

  if (mode === "line") {
    content.addPhantomPoint(board, [1, 1]);
    const r1 = content.realizePhantomPoint(board, [1, 1], "line");
    const r2 = content.realizePhantomPoint(board, [2, 1], "line");
    if (r1.line) created.push(r1.line);
    [r1.point, r2.point].forEach(p => { if (p) created.push(p); });
    content.clearPhantomPoint(board);
    content.clearActiveLine(board);
    return created;
  }

  return created;
}
