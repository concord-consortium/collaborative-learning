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
