import type { HighlightState } from "../document/document-content-with-highlights";

/**
 * The class names a target tile applies to a highlighted object.
 *
 * Shared rather than repeated per tile so one reference reads the same way wherever it lands —
 * these names pair with the ring styles in components/highlight-vars.scss. Tiles whose emphasis
 * is not CSS-driven (the sketch tile draws an SVG rect) will not use this, but any tile that
 * highlights by class should.
 *
 * Exported as a plain function so the mapping can be unit tested without mounting a tile.
 */
export function highlightClassesFor(emphasis: HighlightState | undefined) {
  return {
    "highlight-pinned": emphasis === "pinned",
    "highlight-preview": emphasis === "preview",
  };
}
