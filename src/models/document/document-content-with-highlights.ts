import { computed } from "mobx";
import { DocumentContentModelWithTileDragging } from "./drag-tiles";
import {
  HighlightReference, highlightTargetKey, resolveHighlightReference, sameHighlightReference
} from "../highlights/highlight-reference";
// Type-only import: document-content.ts -> document-content-with-highlights.ts -> this file
// would close a runtime require cycle if this were a value import. See the equivalent note in
// highlight-reference.ts. Do not change this to a value import.
import type { DocumentContentModelType } from "./document-content";

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
 *
 * Some scaffolding here has no production caller yet and is intentional, not dead code:
 * `isObjectActive` is currently only used by `objectState`; `IHighlightTarget.objectType` is
 * populated but never read; and the "object" reference kind has no production producer. These
 * exist for later increments (see the design spec's "Planned increments") that reference
 * non-variable objects directly. Don't delete them as unused.
 */

/** The two states an active reference's targets can be rendered in. */
export type HighlightState = "preview" | "pinned";

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
    get activeSource(): HighlightState | undefined {
      if (self.hoveredRef) {
        // Hovering the reference that is already pinned must not visually downgrade it to
        // "preview" — that would flicker back to "pinned" on mouse-out for no meaningful
        // reason. Rule 1 (hover replaces pin) still applies for any *different* reference.
        if (self.pinnedRef && sameHighlightReference(self.hoveredRef, self.pinnedRef)) {
          return "pinned";
        }
        return "preview";
      }
      if (self.pinnedRef) return "pinned";
      return undefined;
    },
  }))
  .views(self => {
    // PRIVATE BY CONSTRUCTION: a closure local, not a `.views()` getter. MST publishes every
    // `.views()` getter as a public instance member, so putting this Set behind a getter (as an
    // earlier version of this file did) would make it public, typed API on every document in
    // the app regardless of any doc comment saying otherwise. A future text-range reference kind
    // has no id and cannot be expressed as a tileId/objectId pair, so exposing this collection
    // would make that a breaking refactor. Only `isObjectActive` and `objectState` below are
    // returned from this views block.
    //
    // Memoization note: this `computed` only caches its result while some MobX reaction (an
    // `autorun`, or an `observer`-wrapped React component's render, as Task 5's Dataflow node
    // components are) is actively observing it. Read from within such a reaction, repeated
    // `.get()` calls in the same tick share one resolve. Read from OUTSIDE any reaction — e.g. a
    // plain function call, or a test — every `.get()` re-resolves the reference from scratch,
    // walking every tile in the document again.
    const activeTargetKeys = computed(() => {
      const ref = self.activeRef;
      if (!ref) return new Set<string>();
      const targets = resolveHighlightReference(ref, self as unknown as DocumentContentModelType);
      return new Set(targets.map(target => highlightTargetKey(target.tileId, target.objectId)));
    });

    return {
      isObjectActive(tileId: string, objectId: string) {
        return activeTargetKeys.get().has(highlightTargetKey(tileId, objectId));
      },
      /**
       * Every active target shares one state, because only one reference is active at a time.
       * This can never return "pinned" for one object while returning "preview" for another in
       * the same render.
       */
      objectState(tileId: string, objectId: string): HighlightState | undefined {
        return activeTargetKeys.get().has(highlightTargetKey(tileId, objectId))
          ? self.activeSource
          : undefined;
      },
    };
  })
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
