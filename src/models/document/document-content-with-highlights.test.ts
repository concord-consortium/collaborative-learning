// Must be first so mocks are set up before any other imports
import "./document-content-tests/dc-test-utils";
import { getSnapshot } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentSnapshotType } from "./document-content";
import { registerTileTypes } from "../../register-tile-types";
import { IDocumentImportSnapshot } from "./document-content-import-types";
import { SharedModelDocumentManager } from "./shared-model-document-manager";
import { ITileEnvironment } from "../tiles/tile-content";
import { HighlightReference } from "../highlights/highlight-reference";

registerTileTypes(["Text"]);

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

// Object references resolve without any tile cooperation (the object resolver is the identity
// function), which lets these tests exercise precedence and toggling without a Dataflow tile.
const refA: HighlightReference = { kind: "object", tileId: "t1", objectId: "a" };
const refB: HighlightReference = { kind: "object", tileId: "t1", objectId: "b" };

describe("DocumentContentModelWithHighlights", () => {
  let content: ReturnType<typeof createDocumentContentModel>;

  beforeEach(() => {
    content = createDocumentContentModel({ tiles: [] });
  });

  it("has no active highlight by default", () => {
    expect(content.activeRef).toBeUndefined();
    expect(content.activeSource).toBeUndefined();
    expect(content.isObjectActive("t1", "a")).toBe(false);
  });

  it("reports a hovered reference as a preview", () => {
    content.setHoveredRef(refA);
    expect(content.isObjectActive("t1", "a")).toBe(true);
    expect(content.objectState("t1", "a")).toBe("preview");
  });

  it("reports a pinned reference as pinned", () => {
    content.setPinnedRef(refA);
    expect(content.objectState("t1", "a")).toBe("pinned");
  });

  it("returns undefined objectState for an object that is not active", () => {
    content.setPinnedRef(refA);
    expect(content.objectState("t1", "b")).toBeUndefined();
  });

  // The precedence rule: hover REPLACES pin rather than adding to it.
  it("hides the pinned targets while a different reference is hovered", () => {
    content.setPinnedRef(refA);
    content.setHoveredRef(refB);
    expect(content.isObjectActive("t1", "b")).toBe(true);
    expect(content.isObjectActive("t1", "a")).toBe(false);
  });

  it("reverts to the pinned reference on mouse-out rather than clearing", () => {
    content.setPinnedRef(refA);
    content.setHoveredRef(refB);
    content.clearHoveredRef();
    expect(content.isObjectActive("t1", "a")).toBe(true);
    expect(content.objectState("t1", "a")).toBe("pinned");
  });

  it("toggles a pinned reference off when the same reference is toggled again", () => {
    content.togglePinnedRef(refA);
    expect(content.isObjectActive("t1", "a")).toBe(true);
    content.togglePinnedRef(refA);
    expect(content.isObjectActive("t1", "a")).toBe(false);
  });

  it("replaces the pinned reference when a different one is toggled", () => {
    content.togglePinnedRef(refA);
    content.togglePinnedRef(refB);
    expect(content.isObjectActive("t1", "a")).toBe(false);
    expect(content.isObjectActive("t1", "b")).toBe(true);
  });

  // Without this, hovering the chip you just pinned would visually downgrade the highlight to
  // "preview" and then flicker back to "pinned" on mouse-out, with no meaningful state change.
  it("reports pinned, not preview, when hovering the reference that is already pinned", () => {
    content.setPinnedRef(refA);
    content.setHoveredRef(refA);
    expect(content.activeSource).toBe("pinned");
    expect(content.objectState("t1", "a")).toBe("pinned");
  });

  it("does not expose the resolved target collection", () => {
    // Guards rule 2 above: a future textRange kind cannot be expressed as tileId/objectId, so
    // the collection must stay private (isObjectActive/objectState only). If this fails,
    // someone widened the public API by re-exposing the resolved-target Set.
    //
    // Runtime check first: property must genuinely be absent from the instance, not just
    // differently named (a prior version of this test asserted a name — `activeTargets` — that
    // was never the property, so it always passed regardless of what was exposed).
    //
    // Type-level check second: the `@ts-expect-error` below only suppresses a real compiler
    // error. If `activeTargetKeys` is ever reintroduced as a public `.views()` getter, this
    // directive becomes unused and `npm run check:types` fails with
    // "Unused '@ts-expect-error' directive", catching the regression even before a human
    // notices the runtime assertion below would also start failing.
    // @ts-expect-error activeTargetKeys is intentionally not public API
    expect(content.activeTargetKeys).toBeUndefined();
  });

  // Guards the plan's #1 global constraint: highlight state is per-user/per-session and must
  // never be persisted or synced. A future `.props()` addition here would pass every other test
  // in this file while silently breaking that guarantee.
  it("keeps highlight state out of the document snapshot", () => {
    const before = JSON.stringify(getSnapshot(content));
    content.setPinnedRef(refA);
    content.setHoveredRef(refB);
    expect(JSON.stringify(getSnapshot(content))).toBe(before);
  });
});
