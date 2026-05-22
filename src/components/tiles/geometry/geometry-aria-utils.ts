// Accessibility helpers for the Coordinate Grid (geometry) tile: decorating
// the JSXGraph SVG root, building per-object aria-labels, and refreshing
// focusable objects after board mutations.

import type { GeometryContentModelType } from "../../../models/tiles/geometry/geometry-content";
import { forEachBoardObject } from "../../../models/tiles/geometry/geometry-utils";
import {
  isCircle, isComment, isImage, isInfiniteLine, isLinkedPoint, isMovableLine,
  isMovableLineLabel, isPoint, isPolygon, isVertexAngle,
} from "../../../models/tiles/geometry/jxg-types";

/** Decorates the JSXGraph SVG root so it participates in the tile's focus trap. */
export function applyBoardA11yAttributes(svg: SVGElement | undefined): void {
  if (!svg) return;
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Coordinate grid board: empty");
}

/**
 * Returns the aria-live announcer for the geometry tile containing `start`.
 * Uses `:scope >` so nested geometry tiles (e.g. inside a question tile) don't
 * match the wrong announcer.
 */
export function findGeometryAnnouncer(start: Element | null): HTMLElement | null {
  if (!start) return null;
  const wrapper = start.closest(".geometry-tool");
  return wrapper?.querySelector<HTMLElement>(":scope > [data-grid-announcer]") ?? null;
}

/**
 * Announces `message` through the geometry tile's aria-live region. Clears
 * textContent first inside a double-rAF so screen readers re-announce
 * identical consecutive messages (which they otherwise suppress).
 */
export function announceGeometry(start: Element | null, message: string): void {
  const announcer = findGeometryAnnouncer(start);
  if (!announcer) return;
  requestAnimationFrame(() => {
    announcer.textContent = "";
    requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  });
}

/**
 * Direction-aware focus entry for the geometry content slot: forward focuses
 * the SVG board (first stop, carries the summary aria-label); reverse focuses
 * the last element in the semantic Tab order via getOrderedGeometryFocusables.
 * Falls back to DOM-order `tabindex="0"` when board/content aren't supplied.
 */
export function focusGeometryContentEntry(
  content: HTMLElement | undefined,
  reverse: boolean,
  board?: JXG.Board,
  contentModel?: GeometryContentModelType,
): boolean {
  if (!content) return false;
  if (reverse) {
    if (board && contentModel) {
      const ordered = getOrderedGeometryFocusables(board);
      if (ordered.length > 0) {
        const target = ordered[ordered.length - 1];
        target.focus();
        return document.activeElement === target;
      }
    }
    const stops = content.querySelectorAll<HTMLElement | SVGElement>('[tabindex="0"]');
    if (stops.length > 0) {
      const target = stops[stops.length - 1] as HTMLElement;
      target.focus();
      return document.activeElement === target;
    }
  }
  const svg = content.querySelector<SVGElement>("svg");
  if (!svg) return false;
  (svg as unknown as HTMLElement).focus();
  return document.activeElement === svg;
}

// Aria-label builders for visible geometry objects. Each takes a plain-data
// context object (not a JSXGraph object) so it's unit-testable without a
// real board; applyA11yAttributes extracts each element's data into one.

function formatCoord(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 10) / 10).toString();
}

function formatCoordsPair(x: number, y: number): string {
  return `(${formatCoord(x)}, ${formatCoord(y)})`;
}

function selectedSuffix(isSelected: boolean): string {
  return isSelected ? ", Selected" : "";
}

export interface PointAriaContext {
  /** The point's user-facing label (e.g. "P1", "A"). Omitted if empty. */
  name?: string;
  x: number;
  y: number;
  isSelected: boolean;
  /** True for points sourced from a linked Table tile (clientType=linkedPoint). */
  isLinked?: boolean;
  /**
   * When present, the point is a vertex of a polygon — the label leads with
   * "Vertex {index} of {total} of polygon {polygonName}:".
   */
  vertex?: { polygonName: string; index: number; total: number };
}

/** "Point P1 at (3, 4), Selected" — with "Linked point" or "Vertex k of N of polygon X" prefix when applicable. */
export function buildPointAriaLabel(ctx: PointAriaContext): string {
  const coords = formatCoordsPair(ctx.x, ctx.y);
  const namePart = ctx.name ? ` ${ctx.name}` : "";
  if (ctx.vertex) {
    const { polygonName, index, total } = ctx.vertex;
    const suffix = selectedSuffix(ctx.isSelected);
    return `Vertex ${index} of ${total} of polygon ${polygonName}: Point${namePart} at ${coords}${suffix}`;
  }
  if (ctx.isLinked) {
    return `Linked point at ${coords}${selectedSuffix(ctx.isSelected)}`;
  }
  return `Point${namePart} at ${coords}${selectedSuffix(ctx.isSelected)}`;
}

export interface PolygonAriaContext {
  /** The polygon's user-facing label (e.g. "ABCD"). Omitted if empty. */
  name?: string;
  vertexCount: number;
  isSelected: boolean;
}

export function buildPolygonAriaLabel(ctx: PolygonAriaContext): string {
  const namePart = ctx.name ? ` ${ctx.name}` : "";
  const vertexNoun = ctx.vertexCount === 1 ? "vertex" : "vertices";
  return `Polygon${namePart} with ${ctx.vertexCount} ${vertexNoun}${selectedSuffix(ctx.isSelected)}`;
}

export interface CircleAriaContext {
  centerX: number;
  centerY: number;
  radius: number;
  isSelected: boolean;
}

export function buildCircleAriaLabel(ctx: CircleAriaContext): string {
  const center = formatCoordsPair(ctx.centerX, ctx.centerY);
  return `Circle centered at ${center} with radius ${formatCoord(ctx.radius)}${selectedSuffix(ctx.isSelected)}`;
}

export interface LineAriaContext {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  isSelected: boolean;
}

/** "Line through (x1, y1) and (x2, y2)" — "through" signals infinite extent. */
export function buildInfiniteLineAriaLabel(ctx: LineAriaContext): string {
  const a = formatCoordsPair(ctx.p1.x, ctx.p1.y);
  const b = formatCoordsPair(ctx.p2.x, ctx.p2.y);
  return `Line through ${a} and ${b}${selectedSuffix(ctx.isSelected)}`;
}

/** "Movable line from (x1, y1) to (x2, y2)" — "from…to" signals bounded segment. */
export function buildMovableLineAriaLabel(ctx: LineAriaContext): string {
  const a = formatCoordsPair(ctx.p1.x, ctx.p1.y);
  const b = formatCoordsPair(ctx.p2.x, ctx.p2.y);
  return `Movable line from ${a} to ${b}${selectedSuffix(ctx.isSelected)}`;
}

export interface VertexAngleAriaContext {
  degrees: number;
  vertexX: number;
  vertexY: number;
  isSelected: boolean;
}

export function buildVertexAngleAriaLabel(ctx: VertexAngleAriaContext): string {
  const vertex = formatCoordsPair(ctx.vertexX, ctx.vertexY);
  return `Vertex angle of ${formatCoord(ctx.degrees)} degrees at ${vertex}${selectedSuffix(ctx.isSelected)}`;
}

const kCommentMaxChars = 50;

export interface CommentAriaContext {
  text: string;
  /** Label of the anchored object, e.g. "Point P1". */
  anchorLabel?: string;
}

export function buildCommentAriaLabel(ctx: CommentAriaContext): string {
  const text = ctx.text.length > kCommentMaxChars
    ? `${ctx.text.slice(0, kCommentMaxChars)}…`
    : ctx.text;
  const prefix = ctx.anchorLabel ? `Comment on ${ctx.anchorLabel}` : "Comment";
  return `${prefix}: ${text}`;
}

export interface ImageAriaContext {
  width: number;
  height: number;
}

/** "Background image, W × H pixels" — true U+00D7 so the screen reader says "by". */
export function buildImageAriaLabel(ctx: ImageAriaContext): string {
  return `Background image, ${ctx.width} × ${ctx.height} pixels`;
}

export interface BoardSummaryAriaContext {
  byType: {
    points: number;
    polygons: number;
    circles: number;
    lines: number;
  };
  selectedCount: number;
}

const kBoardSummaryTypeLabels = {
  points:   { singular: "point",   plural: "points"   },
  polygons: { singular: "polygon", plural: "polygons" },
  circles:  { singular: "circle",  plural: "circles"  },
  lines:    { singular: "line",    plural: "lines"    },
} as const;

/** "Coordinate grid board: N points, M selected" — what a screen reader hears on board entry. */
export function buildBoardSummaryAriaLabel(ctx: BoardSummaryAriaContext): string {
  const segments: string[] = [];
  for (const key of ["points", "polygons", "circles", "lines"] as const) {
    const count = ctx.byType[key];
    if (count > 0) {
      const noun = count === 1
        ? kBoardSummaryTypeLabels[key].singular
        : kBoardSummaryTypeLabels[key].plural;
      segments.push(`${count} ${noun}`);
    }
  }
  if (segments.length === 0) return "Coordinate grid board: empty";
  if (ctx.selectedCount > 0) {
    segments.push(`${ctx.selectedCount} selected`);
  }
  return `Coordinate grid board: ${segments.join(", ")}`;
}

export function updateBoardAriaLabel(board: JXG.Board, content: GeometryContentModelType): void {
  const svg = board.containerObj?.querySelector("svg") as SVGElement | null;
  if (!svg) return;
  const byType = { points: 0, polygons: 0, circles: 0, lines: 0 };
  let selectedCount = 0;
  forEachBoardObject(board, elt => {
    const isPhantom = !!elt.getAttribute("isPhantom");
    const isInvisible = elt.visProp && !elt.visProp.visible;
    if (isPhantom || isInvisible) return;
    if (isPoint(elt)) byType.points += 1;
    else if (isPolygon(elt)) byType.polygons += 1;
    else if (isCircle(elt)) byType.circles += 1;
    else if (isInfiniteLine(elt) || isMovableLine(elt)) byType.lines += 1;
    else return;
    if (content.isSelected(elt.id)) selectedCount += 1;
  });
  svg.setAttribute("aria-label", buildBoardSummaryAriaLabel({ byType, selectedCount }));
}

// ---------------------------------------------------------------------------
// Per-element attribute application
// ---------------------------------------------------------------------------

function pointXY(point: JXG.Point): [number, number] {
  const [, x, y] = point.coords.usrCoords;
  return [x, y];
}

interface VertexInfo {
  polygonName: string;
  /** 1-based; excludes the closing-vertex duplicate. */
  index: number;
  total: number;
}

interface ApplyA11yOptions {
  /** Set by the polygon recursion so each vertex gets a "Vertex k of N…" label. */
  vertexInfo?: VertexInfo;
  /** Read-only boards (navigator mini-map, read-only docs) clear attrs so objects skip the Tab cycle. */
  readOnly?: boolean;
}

function clearA11yAttributes(rendNode: HTMLElement | undefined): void {
  if (!rendNode) return;
  rendNode.removeAttribute("tabindex");
  rendNode.removeAttribute("role");
  rendNode.removeAttribute("aria-pressed");
  rendNode.removeAttribute("aria-label");
  rendNode.removeAttribute("data-object-id");
}

function writeButtonA11yAttributes(
  rendNode: HTMLElement, id: string, label: string, isSelected: boolean,
): void {
  rendNode.setAttribute("tabindex", "0");
  rendNode.setAttribute("role", "button");
  rendNode.setAttribute("aria-pressed", isSelected ? "true" : "false");
  rendNode.setAttribute("aria-label", label);
  rendNode.setAttribute("data-object-id", id);
}

/**
 * Decorates a JSXGraph element's rendNode for screen readers and the focus
 * trap. Phantom / invisible / read-only elements get their attributes cleared
 * so they drop out of the Tab cycle. Polygons recurse over their vertices
 * with vertex-aware labels.
 */
export function applyA11yAttributes(
  elt: JXG.GeometryElement,
  content: GeometryContentModelType,
  options: ApplyA11yOptions = {},
): void {
  const { vertexInfo, readOnly } = options;
  const rendNode = elt.rendNode;
  if (!rendNode) return;

  const isPhantom = !!elt.getAttribute("isPhantom");
  const isInvisible = elt.visProp && !elt.visProp.visible;
  if (readOnly || isPhantom || isInvisible) {
    clearA11yAttributes(rendNode);
    return;
  }

  const isSelected = content.isSelected(elt.id);

  if (isPolygon(elt)) {
    const vertices = polygonVertices(elt);
    const label = buildPolygonAriaLabel({
      name: elt.name || undefined, vertexCount: vertices.length, isSelected,
    });
    writeButtonA11yAttributes(rendNode, elt.id, label, isSelected);
    vertices.forEach((vertex, i) => {
      applyA11yAttributes(vertex, content, {
        vertexInfo: {
          polygonName: elt.name || "unnamed",
          index: i + 1,
          total: vertices.length,
        },
      });
    });
    return;
  }

  if (isPoint(elt)) {
    // A full-board refresh also reaches each polygon vertex standalone (with
    // no vertexInfo); skip so the polygon's recursive pass owns the label —
    // otherwise iteration order would determine whether the vertex gets the
    // "Vertex k of N of polygon X" label or a bare "Point" label.
    if (!vertexInfo && isPolygonVertex(elt)) return;
    const [x, y] = pointXY(elt);
    const label = buildPointAriaLabel({
      name: elt.name || undefined,
      x, y,
      isSelected,
      isLinked: isLinkedPoint(elt),
      vertex: vertexInfo,
    });
    writeButtonA11yAttributes(rendNode, elt.id, label, isSelected);
    return;
  }

  if (isCircle(elt)) {
    const [cx, cy] = pointXY(elt.center as JXG.Point);
    const label = buildCircleAriaLabel({
      centerX: cx, centerY: cy, radius: elt.Radius(), isSelected,
    });
    writeButtonA11yAttributes(rendNode, elt.id, label, isSelected);
    return;
  }

  if (isInfiniteLine(elt) || isMovableLine(elt)) {
    const [x1, y1] = pointXY(elt.point1 as JXG.Point);
    const [x2, y2] = pointXY(elt.point2 as JXG.Point);
    const builder = isInfiniteLine(elt) ? buildInfiniteLineAriaLabel : buildMovableLineAriaLabel;
    const label = builder({
      p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, isSelected,
    });
    writeButtonA11yAttributes(rendNode, elt.id, label, isSelected);
    return;
  }

  if (isVertexAngle(elt)) {
    // JXG.Angle: `point` is the vertex; `Value()` returns radians.
    const angle = elt as unknown as { point: JXG.Point; Value: () => number };
    const [vx, vy] = pointXY(angle.point);
    const label = buildVertexAngleAriaLabel({
      degrees: angle.Value() * 180 / Math.PI,
      vertexX: vx, vertexY: vy, isSelected,
    });
    writeButtonA11yAttributes(rendNode, elt.id, label, isSelected);
    return;
  }

  if (isComment(elt)) {
    const text = (elt as JXG.Text).plaintext ?? "";
    const label = buildCommentAriaLabel({ text, anchorLabel: resolveAnchorLabel(elt) });
    writeButtonA11yAttributes(rendNode, elt.id, label, isSelected);
    return;
  }

  if (isMovableLineLabel(elt)) {
    // Reachable via the parent line — not its own tab stop.
    clearA11yAttributes(rendNode);
    return;
  }

  if (isImage(elt)) {
    // `.size` is present at runtime but missing from the .d.ts.
    const image = elt as unknown as { size: [number, number] };
    const [width, height] = image.size ?? [0, 0];
    const label = buildImageAriaLabel({ width, height });
    writeButtonA11yAttributes(rendNode, elt.id, label, isSelected);
  }
}

/** JSXGraph closes polygons by repeating vs[0] as the last vertex; drop that duplicate. */
function polygonVertices(polygon: JXG.Polygon): JXG.Point[] {
  const vs = polygon.vertices as JXG.Point[];
  if (vs.length >= 2 && vs[vs.length - 1] === vs[0]) {
    return vs.slice(0, -1);
  }
  return vs;
}

function isPolygonVertex(point: JXG.Point): boolean {
  const descendants = point.descendants ?? {};
  return Object.values(descendants).some(isPolygon);
}

function describeAnchorElement(anchor: JXG.GeometryElement): string | undefined {
  const name = anchor.name || undefined;
  if (isPoint(anchor)) return name ? `Point ${name}` : "Point";
  if (isPolygon(anchor)) return name ? `Polygon ${name}` : "Polygon";
  if (isCircle(anchor)) return "Circle";
  if (isInfiniteLine(anchor) || isMovableLine(anchor)) return "Line";
  return undefined;
}

function resolveAnchorLabel(comment: JXG.GeometryElement): string | undefined {
  const anchorId = comment.getAttribute("anchor");
  if (!anchorId) return undefined;
  const anchor = comment.board?.objects?.[anchorId] as JXG.GeometryElement | undefined;
  return anchor ? describeAnchorElement(anchor) : undefined;
}

/**
 * Re-applies a11y attributes to every board object and refreshes the summary
 * label in one pass. Caller skips during active drag.
 */
export function refreshA11yAttributes(
  board: JXG.Board, content: GeometryContentModelType, readOnly = false,
): void {
  forEachBoardObject(board, elt => applyA11yAttributes(elt, content, { readOnly }));
  updateBoardAriaLabel(board, content);
}

function isFocusableForTabOrder(elt: JXG.GeometryElement): boolean {
  if (!elt.rendNode) return false;
  if (elt.getAttribute("isPhantom")) return false;
  if (elt.visProp && !elt.visProp.visible) return false;
  return elt.rendNode.getAttribute("tabindex") === "0";
}

/**
 * Visible focusable rendNodes in a screen-reader-friendly Tab order: each
 * compound shape (polygon / circle / infinite / movable line) followed by its
 * defining points, then orphan points, then standalone elements (vertex
 * angles, comments, images). Points shared across shapes appear once, under
 * the first shape that claims them.
 *
 * Why a custom order: JSXGraph paints shape outlines before points, so plain
 * DOM-order Tab would walk every shape first then every point — including
 * points the user just heard described as belonging to a shape.
 */
export function getOrderedGeometryFocusables(board: JXG.Board): HTMLElement[] {
  const ordered: HTMLElement[] = [];
  const seenPointIds = new Set<string>();

  // Compound shapes + their defining points (in creation order).
  forEachBoardObject(board, elt => {
    if (!isFocusableForTabOrder(elt)) return;
    if (isPolygon(elt) || isCircle(elt) || isInfiniteLine(elt) || isMovableLine(elt)) {
      ordered.push(elt.rendNode);
      const definingPoints = Object.values(elt.ancestors).filter(isPoint);
      for (const pt of definingPoints) {
        if (!isFocusableForTabOrder(pt)) continue;
        if (seenPointIds.has(pt.id)) continue;
        seenPointIds.add(pt.id);
        ordered.push(pt.rendNode);
      }
    }
  });

  // Orphan points + standalone elements.
  forEachBoardObject(board, elt => {
    if (!isFocusableForTabOrder(elt)) return;
    if (isPoint(elt)) {
      if (seenPointIds.has(elt.id)) return;
      seenPointIds.add(elt.id);
      ordered.push(elt.rendNode);
      return;
    }
    if (isVertexAngle(elt) || isComment(elt) || isImage(elt)) {
      ordered.push(elt.rendNode);
    }
  });

  return ordered;
}
