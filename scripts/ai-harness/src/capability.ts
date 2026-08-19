/**
 * Per-tile-type capability registry plus document classification.
 *
 * The type-level flags say what a tile *can* hold. Classifying a real document also applies
 * instance-level checks (does this Text tile actually have text?), so `computedModality` describes
 * the document in front of us rather than the tile types it happens to use.
 */
import { tileTypes } from "../../../shared/tile-types.js";
import { slateToMarkdown } from "../../../shared/slate-to-markdown.js";
import type { Modality } from "./schemas.js";

export interface TileRepresentationCapability {
  /** Can students author text content in this tile type? */
  containsStudentText: boolean;
  /** How well the current text summarizer carries this tile type. */
  summaryFidelity: "full" | "partial" | "stub" | "fallback";
  /** Does an image add information that text cannot carry? */
  requiresVisualRepresentation: boolean;
}

function capability(
  containsStudentText: boolean,
  summaryFidelity: TileRepresentationCapability["summaryFidelity"],
  requiresVisualRepresentation: boolean
): TileRepresentationCapability {
  return { containsStudentText, summaryFidelity, requiresVisualRepresentation };
}

/**
 * Unlisted tile types are conservatively treated as visual so nothing silently drops out of an
 * image-based representation.
 */
export const unknownTileCapability: TileRepresentationCapability = capability(false, "fallback", true);

/**
 * Several `fallback` types can in fact hold typed text (DataCard field values, for one). This
 * records that as a known simplification rather than guessing per type; an instance-level check
 * could upgrade them later, and anything noticed while authoring fixtures is recorded in the
 * synthetic corpus's expectations.json.
 */
export const tileCapabilities: Record<string, TileRepresentationCapability> = {
  Text: capability(true, "full", false),
  Table: capability(true, "full", false),
  Dataflow: capability(true, "full", true),
  Graph: capability(false, "full", true),
  Simulator: capability(false, "partial", true),
  // A Question tile is a container: its children classify individually (see classifyDocument).
  Question: capability(false, "partial", false),
  Drawing: capability(true, "stub", true),
  Image: capability(false, "stub", true),
  Geometry: capability(false, "fallback", true),
  Diagram: capability(false, "fallback", true),
  BarGraph: capability(false, "fallback", true),
  DataCard: capability(false, "fallback", true),
  Numberline: capability(false, "fallback", true),
  Expression: capability(false, "fallback", true),
  Timeline: capability(false, "fallback", true),
  WaveRunner: capability(false, "fallback", true),
  AI: capability(false, "fallback", true),
  ErrorTest: capability(false, "fallback", true),
  Starter: capability(false, "fallback", true),
  IframeInteractive: capability(false, "fallback", true),
  Placeholder: capability(false, "full", false),
  Unknown: unknownTileCapability
};

export function getTileCapability(tileType: string): TileRepresentationCapability {
  return tileCapabilities[tileType] ?? unknownTileCapability;
}

/** Every registered tile type must have a record; a missing one is a bug, not a default. */
export function missingCapabilityTypes(): string[] {
  return tileTypes.filter((type) => !(type in tileCapabilities));
}

// ---------------------------------------------------------------------------
// Instance-level checks
// ---------------------------------------------------------------------------

/** A Text tile counts as student text only when its content is non-empty after trimming. */
export function textTileHasContent(content: any): boolean {
  const text = content?.text;
  if (typeof text !== "string") return false;
  if (content.format === "slate") {
    try {
      return slateToMarkdown(text).trim().length > 0;
    } catch {
      return text.trim().length > 0;
    }
  }
  return text.trim().length > 0;
}

/** A Drawing tile counts as student text only when it has text objects that actually say something. */
export function drawingTileHasText(content: any): boolean {
  const objects = content?.objects;
  if (!Array.isArray(objects)) return false;
  return objects.some((object: any) =>
    object?.type === "text" && typeof object.text === "string" && object.text.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Document classification
// ---------------------------------------------------------------------------

/** How deep nested Question tiles may recurse before we assume a cycle. */
export const kMaxQuestionDepth = 8;

export interface ClassifiedTile {
  tileId: string;
  tileType: string;
  /** "student" for ordinary tiles and Question responses; "prompt" for a Question's authored prompt. */
  role: "student" | "prompt";
  capability: TileRepresentationCapability;
  /** Type capability narrowed by the instance-level checks above. */
  hasStudentText: boolean;
  requiresVisualRepresentation: boolean;
}

export interface DocumentClassification {
  computedModality: Modality;
  tiles: ClassifiedTile[];
  warnings: string[];
}

interface TileRef { tileId?: string }
interface RowLike { tiles?: TileRef[]; isSectionHeader?: boolean }

function rowsOf(container: any): RowLike[] {
  const { rowOrder, rowMap } = container ?? {};
  if (!Array.isArray(rowOrder) || !rowMap) return [];
  return rowOrder.map((rowId: string) => rowMap[rowId]).filter(Boolean);
}

/**
 * Classifies every tile a document holds, following Question tiles into their nested rows.
 *
 * Rules for Question traversal (the nested rowOrder/rowMap resolves ids through the *document's*
 * top-level tileMap, exactly as handleQuestionTile() in shared/ai-summarizer does):
 * - the first row holds the authored prompt, which is not student work and contributes nothing;
 * - the remaining rows are the student response and classify individually by their own types;
 * - a Question nested inside a prompt stays authored all the way down: its own rows do not get to
 *   reintroduce "student", because the whole subtree is curriculum content;
 * - a missing tile reference is skipped and recorded as a warning;
 * - a tile referenced twice counts once;
 * - nested Questions recurse, up to kMaxQuestionDepth.
 */
export function classifyDocument(content: any): DocumentClassification {
  const tileMap = content?.tileMap ?? {};
  const tiles: ClassifiedTile[] = [];
  const warnings: string[] = [];
  const visited = new Set<string>();

  const visit = (tileId: string, role: ClassifiedTile["role"], depth: number): void => {
    if (visited.has(tileId)) return;
    visited.add(tileId);

    const tile = tileMap[tileId];
    if (!tile || !tile.content) {
      warnings.push(`tile reference "${tileId}" is not present in the document's tileMap`);
      return;
    }

    const tileType = typeof tile.content.type === "string" ? tile.content.type : "Unknown";
    const tileCapability = getTileCapability(tileType);

    if (tileType === "Question") {
      tiles.push({
        tileId,
        tileType,
        role,
        capability: tileCapability,
        hasStudentText: false,
        requiresVisualRepresentation: false
      });
      if (depth >= kMaxQuestionDepth) {
        warnings.push(`question tile "${tileId}" exceeds the nesting depth cap of ${kMaxQuestionDepth}`);
        return;
      }
      const questionRows = rowsOf(tile.content);
      questionRows.forEach((row, rowIndex) => {
        for (const ref of row.tiles ?? []) {
          if (!ref?.tileId) continue;
          // Role is inherited, not recomputed from row position: once we are inside an authored
          // prompt, everything below it is authored too. Recomputing would let a Question nested in
          // a prompt hand "student" back to its own later rows.
          visit(ref.tileId, role === "prompt" || rowIndex === 0 ? "prompt" : "student", depth + 1);
        }
      });
      return;
    }

    let hasStudentText = tileCapability.containsStudentText;
    if (tileType === "Text") hasStudentText = textTileHasContent(tile.content);
    if (tileType === "Drawing") hasStudentText = drawingTileHasText(tile.content);
    // An authored question prompt is not student work, whatever it happens to contain.
    if (role === "prompt") hasStudentText = false;

    tiles.push({
      tileId,
      tileType,
      role,
      capability: tileCapability,
      hasStudentText,
      requiresVisualRepresentation: role === "prompt" ? false : tileCapability.requiresVisualRepresentation
    });
  };

  for (const row of rowsOf(content)) {
    if (row.isSectionHeader) continue;
    for (const ref of row.tiles ?? []) {
      if (!ref?.tileId) continue;
      visit(ref.tileId, "student", 0);
    }
  }

  const hasText = tiles.some((tile) => tile.hasStudentText);
  const hasVisual = tiles.some((tile) => tile.requiresVisualRepresentation);
  const computedModality: Modality = hasText && hasVisual ? "mixed"
    : hasText ? "text-only"
    : hasVisual ? "visual-only"
    : "empty";

  return { computedModality, tiles, warnings };
}
