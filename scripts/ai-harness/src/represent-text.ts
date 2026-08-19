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
}

export const textVariants: Record<string, TextVariant> = {
  default: {
    id: "default",
    variantVersion: 1,
    render: (content) => documentSummarizer(content, {})
  },
  minimal: {
    id: "minimal",
    variantVersion: 1,
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
    variantVersion: 1,
    render: (content) => documentSummarizer(content, { dataSetTables: "schema-only" })
  },
  /**
   * `default` with drawings described rather than merely mentioned.
   *
   * The default handler says "This tile contains a drawing" and stops, so a text-only run is told
   * nothing about what the student drew — which is most of what a visual document *is*, and a large
   * part of why an image run might beat a text one. This variant swaps in a pure serializer that
   * lists each object's type, position and size, and any text objects' text.
   *
   * A measurement prototype, deliberately unambitious: it describes geometry and does not interpret
   * it. Beating it is the point, and a variant is how someone would show that they had.
   */
  "drawing-text": {
    id: "drawing-text",
    variantVersion: 1,
    // Ahead of the defaults, which is how `documentSummarizerWithDrawings` composes: the first
    // handler that answers wins, so this one takes the Drawing tiles and the rest are untouched.
    render: (content) => documentSummarizer(content, {
      tileHandlers: [handleDrawingTileText, ...defaultTileHandlers]
    })
  }
};

export const textVariantIds: readonly string[] = Object.keys(textVariants);

export function getTextVariant(id: string): TextVariant {
  const variant = textVariants[id];
  if (!variant) {
    throw new Error(`Unknown text variant "${id}". Known variants: ${textVariantIds.join(", ")}`);
  }
  return variant;
}
