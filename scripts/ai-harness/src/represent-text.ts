/**
 * Text representations of a document.
 *
 * Each variant wraps `documentSummarizer` from shared/ai-summarizer so the harness measures exactly
 * what production produces. `variantVersion` is bumped whenever a variant's output would change for
 * the same input; the representation envelope records it so stale caches are detected.
 *
 * The `svg-drawings` variant (documentSummarizerWithDrawings) is deliberately absent — see the
 * README. It pulls in src/plugins/drawing, which imports .svg assets that only a bundler can load.
 */
import { documentSummarizer } from "../../../shared/ai-summarizer/ai-summarizer.js";
import { defaultTileHandlers } from "../../../shared/ai-summarizer/ai-tile-summarizer.js";
import {
  handleDrawingTileText
} from "../../../shared/ai-summarizer/tile-summarizers/handle-drawing-tile-text.js";

export interface TextVariant {
  id: string;
  /** Bump when this variant's output would change for the same input. */
  variantVersion: number;
  render(content: unknown): string;
  /**
   * Whether this variant would put student content in the summary for a document the classifier
   * says carries no student-authored text.
   *
   * Skip-empty asks "would the summary carry any student content", and answers it from the
   * classifier: does any tile hold text a student wrote. That is the right question for every
   * variant that only passes text through, and the wrong one for a variant whose whole purpose is
   * turning something else into words — `drawing-text` describes geometry, and a drawing of two
   * shapes holds no student *text* while very much holding student work. Without this the decision
   * is variant-blind, and the fixture a variant exists for is skipped before the variant is
   * consulted.
   *
   * Absent means "nothing the classifier missed", which is true of every pass-through variant.
   */
  findsStudentContentWithoutText?(content: unknown): boolean;
}

export const textVariants: Record<string, TextVariant> = {
  default: {
    id: "default",
    variantVersion: 2,
    render: (content) => documentSummarizer(content, {})
  },
  minimal: {
    id: "minimal",
    variantVersion: 2,
    render: (content) => documentSummarizer(content, { minimal: true })
  },
  /**
   * `default` with each data set's case data left out — the heading, the attributes, the formulas
   * and the case count stay, so the shape of the data is still described.
   *
   * A large table can be most of a document's summary, and whether a model needs the rows to
   * categorize a *design* is exactly the sort of question the harness exists to answer rather than
   * assume. Two further ways to shrink a table are named in the plan and not built here: sending a
   * fixed sample of cases, and sending aggregate statistics instead. Both are variants of their own
   * when someone wants to measure them.
   */
  "no-dataset-tables": {
    id: "no-dataset-tables",
    variantVersion: 2,
    render: (content) => documentSummarizer(content, { dataSetTables: "schema-only" })
  },
  /**
   * `default` with drawings described by the harness's own prototype serializer.
   *
   * Written when the production handler said "This tile contains a drawing" and stopped, so a
   * text-only run was told nothing about what the student drew. It swaps in a pure serializer that
   * lists each object's type, position and size, and any text objects' text.
   *
   * CLUE has since given the production handler an object table of its own, so `default` now
   * describes a drawing too and this is no longer the only text variant that carries what was
   * drawn. It is kept as the earlier prototype: runs recorded with it are still comparable, and
   * `experiments/mixed-vs-baselines.json` names its `text-drawing-text` run.
   */
  "drawing-text": {
    id: "drawing-text",
    variantVersion: 2,
    // Ahead of the defaults, which is how `documentSummarizerWithDrawings` composes: the first
    // handler that answers wins, so this one takes the Drawing tiles and the rest are untouched.
    render: (content) => documentSummarizer(content, {
      tileHandlers: [handleDrawingTileText, ...defaultTileHandlers]
    }),
    // A drawing with objects in it is student work this variant can describe, whether or not any of
    // those objects is a text object. An empty drawing is not: `handleDrawingTileText` answers
    // "which is empty", and a summary saying that carries nothing.
    findsStudentContentWithoutText: (content) =>
      tilesOf(content).some((tile) => {
        const tileContent = (tile as { content?: { type?: string; objects?: unknown } })?.content;
        return tileContent?.type === "Drawing" && Array.isArray(tileContent.objects) &&
          tileContent.objects.length > 0;
      })
  }
};

/**
 * Every tile in a document's tile map, nested ones included.
 *
 * The map is flat — a Question tile's children are entries in it like any other — so this is the
 * whole document's tiles without walking rows.
 */
function tilesOf(content: unknown): unknown[] {
  const tileMap = (content as { tileMap?: Record<string, unknown> })?.tileMap;
  return tileMap && typeof tileMap === "object" ? Object.values(tileMap) : [];
}

export const textVariantIds: readonly string[] = Object.keys(textVariants);

export function getTextVariant(id: string): TextVariant {
  const variant = textVariants[id];
  if (!variant) {
    throw new Error(`Unknown text variant "${id}". Known variants: ${textVariantIds.join(", ")}`);
  }
  return variant;
}
