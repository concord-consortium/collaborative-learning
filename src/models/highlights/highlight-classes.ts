import type { HighlightState } from "../document/document-content-with-highlights";

/**
 * The class names a target tile applies to a highlighted object.
 *
 * Shared rather than repeated per tile so one reference reads the same way wherever it lands —
 * these names pair with the ring styles in components/highlight-vars.scss. The element carrying
 * the class is whatever the tile draws its emphasis on, and need not be HTML: the sketch tile
 * puts these on an SVG rect it renders at layer level.
 *
 * Exported as a plain function so the mapping can be unit tested without mounting a tile.
 */
export function highlightClassesFor(emphasis: HighlightState | undefined) {
  return {
    "highlight-pinned": emphasis === "pinned",
    "highlight-preview": emphasis === "preview",
  };
}
