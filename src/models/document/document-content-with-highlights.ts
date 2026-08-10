import { DocumentContentModelWithTileDragging } from "./drag-tiles";
import {
  HighlightReference, highlightTargetKey, resolveHighlightReference, sameHighlightReference
} from "../highlights/highlight-reference";

/**
 * This is one part of the DocumentContentModel. It holds the ephemeral highlight state that
 * lets one part of a document point at objects inside another tile.
 *
 * Everything here is VOLATILE and must stay that way. Highlights are per-user and
 * per-session: they are never persisted, never synced to Firebase, and never visible to
 * other people viewing the same document. Adding a `.props()` entry to this file would
 * change all three of those things.
 *
 * The pattern mirrors DataSet's volatile caseSelection/attributeSelection, which is how
 * table<->graph linked selection already works.
 */
export const DocumentContentModelWithHighlights = DocumentContentModelWithTileDragging
  .named("DocumentContentModelWithHighlights")
  .volatile(self => ({
    hoveredRef: undefined as HighlightReference | undefined,
    pinnedRef: undefined as HighlightReference | undefined,
  }))
  .views(self => ({
    /**
     * Exactly one reference is active at a time. Hover REPLACES pin rather than adding to it:
     * while previewing you want to see what you are previewing, and on mouse-out this reverts
     * to the pinned reference rather than clearing.
     */
    get activeRef(): HighlightReference | undefined {
      return self.hoveredRef ?? self.pinnedRef;
    },
    get activeSource(): "preview" | "pinned" | undefined {
      if (self.hoveredRef) return "preview";
      if (self.pinnedRef) return "pinned";
      return undefined;
    },
  }))
  .views(self => ({
    /**
     * PRIVATE. Resolved once per reference change rather than once per node per render —
     * isObjectActive is called from inside every Dataflow node's render and must be O(1).
     *
     * Do not export this or add a public view that returns it. A text range (a planned later
     * increment) has no id and cannot be expressed as a tileId/objectId pair, so widening the
     * API to expose this collection would make that a breaking refactor.
     */
    get activeTargetKeys(): Set<string> {
      const ref = self.activeRef;
      if (!ref) return new Set<string>();
      const targets = resolveHighlightReference(ref, self as any);
      return new Set(targets.map(target => highlightTargetKey(target.tileId, target.objectId)));
    },
  }))
  .views(self => ({
    isObjectActive(tileId: string, objectId: string) {
      return self.activeTargetKeys.has(highlightTargetKey(tileId, objectId));
    },
    /**
     * Every active target shares one state, because only one reference is active at a time.
     * This can never return "pinned" for one object while returning "preview" for another in
     * the same render.
     */
    objectState(tileId: string, objectId: string): "preview" | "pinned" | undefined {
      return self.activeTargetKeys.has(highlightTargetKey(tileId, objectId))
        ? self.activeSource
        : undefined;
    },
  }))
  .actions(self => ({
    setHoveredRef(ref: HighlightReference) {
      self.hoveredRef = ref;
    },
    clearHoveredRef() {
      self.hoveredRef = undefined;
    },
    setPinnedRef(ref: HighlightReference) {
      self.pinnedRef = ref;
    },
    clearPinnedRef() {
      self.pinnedRef = undefined;
    },
  }))
  .actions(self => ({
    togglePinnedRef(ref: HighlightReference) {
      if (self.pinnedRef && sameHighlightReference(self.pinnedRef, ref)) {
        self.clearPinnedRef();
      } else {
        self.setPinnedRef(ref);
      }
    },
  }));
