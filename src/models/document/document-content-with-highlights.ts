import { computed } from "mobx";
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
 * A highlight is deliberately NOT selection, even though the two can look alike. Selection is
 * operational — it is the implicit argument to the next action (delete, drag, group, toolbar
 * buttons) — and it is suppressed in read-only views. A highlight is informational: it says
 * "look here" without arming anything, and it must render in read-only documents, 4-up cells
 * and thumbnails. A highlight also has to outlive the user's next click, or acting on the
 * guidance would destroy it.
 */

/** The two states a highlighted object can be rendered in. */
export type HighlightState = "preview" | "pinned";

export const DocumentContentModelWithHighlights = DocumentContentModelWithTileDragging
  .named("DocumentContentModelWithHighlights")
  .volatile(self => ({
    hoveredHighlightRef: undefined as HighlightReference | undefined,
    pinnedHighlightRef: undefined as HighlightReference | undefined,
  }))
  .views(self => ({
    /**
     * Exactly one reference is highlighted at a time. Hover REPLACES pin rather than adding to
     * it: while previewing you want to see what you are previewing, and on mouse-out this
     * reverts to the pinned reference rather than clearing.
     */
    get highlightRef(): HighlightReference | undefined {
      return self.hoveredHighlightRef ?? self.pinnedHighlightRef;
    },
    get highlightState(): HighlightState | undefined {
      if (self.hoveredHighlightRef) {
        // Hovering the reference that is already pinned must not visually downgrade it to
        // "preview" — that would flicker back to "pinned" on mouse-out for no meaningful
        // reason. Rule 1 (hover replaces pin) still applies for any *different* reference.
        if (self.pinnedHighlightRef
            && sameHighlightReference(self.hoveredHighlightRef, self.pinnedHighlightRef)) {
          return "pinned";
        }
        return "preview";
      }
      if (self.pinnedHighlightRef) return "pinned";
      return undefined;
    },
  }))
  .views(self => {
    // A private closure variable for encapsulation. Keep it that way: a text-range reference kind
    // has no id and cannot be expressed as a tileId/objectId pair, so callers must go through
    // `isObjectHighlighted`/`objectHighlightState` rather than the target collection itself.
    const highlightedTargetKeys = computed(() => {
      const ref = self.highlightRef;
      if (!ref) return new Set<string>();
      const targets = resolveHighlightReference(ref, self);
      return new Set(targets.map(target => highlightTargetKey(target.tileId, target.objectId)));
    });

    function isObjectHighlighted(tileId?: string, objectId?: string) {
      if (!tileId || !objectId) return false;
      return highlightedTargetKeys.get().has(highlightTargetKey(tileId, objectId));
    }

    return {
      isObjectHighlighted,
      /**
       * Every highlighted object shares one state, because only one reference is highlighted at
       * a time. This can never return "pinned" for one object while returning "preview" for
       * another in the same render.
       */
      objectHighlightState(tileId?: string, objectId?: string): HighlightState | undefined {
        return isObjectHighlighted(tileId, objectId) ? self.highlightState : undefined;
      },
    };
  })
  .actions(self => ({
    setHoveredHighlightRef(ref: HighlightReference) {
      self.hoveredHighlightRef = ref;
    },
    clearHoveredHighlightRef() {
      self.hoveredHighlightRef = undefined;
    },
    setPinnedHighlightRef(ref: HighlightReference) {
      self.pinnedHighlightRef = ref;
    },
    clearPinnedHighlightRef() {
      self.pinnedHighlightRef = undefined;
    },
  }))
  .actions(self => ({
    togglePinnedHighlightRef(ref: HighlightReference) {
      if (self.pinnedHighlightRef && sameHighlightReference(self.pinnedHighlightRef, ref)) {
        self.clearPinnedHighlightRef();
      } else {
        self.setPinnedHighlightRef(ref);
      }
    },
  }));
