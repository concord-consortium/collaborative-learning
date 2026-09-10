// The chip's handlers are extracted into makeChipHighlightHandlers, and its unmount cleanup into
// releaseOwnHighlightRefs, so they can be tested without standing up a Slate editor. The rendered
// interaction (that the handlers are attached to the right element, and that unmounting a hovered
// chip clears its preview) is covered by Cypress in highlight_references_spec.js.
//
// The `source` argument threaded through these is what identifies one chip instance. Two chips can
// reference the same variable, so the reference alone cannot say which chip set a highlight.
import "../../../models/document/document-content-tests/dc-test-utils";
import {
  DocumentContentModel, DocumentContentSnapshotType
} from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";
import { makeChipHighlightHandlers, releaseOwnHighlightRefs } from "./variables-plugin";

registerTileTypes(["Text"]);

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

const emptyContent = () => createDocumentContentModel({ tiles: [] });

describe("makeChipHighlightHandlers", () => {
  it("previews on mouse-enter and clears on mouse-leave", () => {
    const content = emptyContent();
    const handlers = makeChipHighlightHandlers(content, "var-emg", "chip-1");

    handlers.onMouseEnter();
    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-emg" });
    expect(content.highlightState).toBe("preview");

    handlers.onMouseLeave();
    expect(content.highlightRef).toBeUndefined();
  });

  it("pins on click and unpins when the same chip is clicked again", () => {
    const content = emptyContent();
    const handlers = makeChipHighlightHandlers(content, "var-emg", "chip-1");

    handlers.onClick();
    expect(content.highlightState).toBe("pinned");

    handlers.onClick();
    expect(content.highlightRef).toBeUndefined();
  });

  // Clicking a different control that means the same thing should not turn the highlight off —
  // the user is asking to see that thing, not to dismiss it. The second chip takes the pin over.
  it("takes the pin over rather than releasing it when a different chip cites the same variable", () => {
    const content = emptyContent();
    const first = makeChipHighlightHandlers(content, "var-emg", "chip-1");
    const second = makeChipHighlightHandlers(content, "var-emg", "chip-2");

    first.onClick();
    second.onClick();

    expect(content.highlightState).toBe("pinned");
    expect(content.pinnedHighlightSource).toBe("chip-2");
  });

  it("lets a hovered chip take over from a pinned one, then restores the pin", () => {
    const content = emptyContent();
    const emg = makeChipHighlightHandlers(content, "var-emg", "chip-emg");
    const gripper = makeChipHighlightHandlers(content, "var-gripper", "chip-gripper");

    emg.onClick();
    gripper.onMouseEnter();
    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-gripper" });

    gripper.onMouseLeave();
    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-emg" });
  });

  // A chip whose element has no reference, or that lives in a detached tree, must no-op rather
  // than throw. getDocumentContentFromNode returns undefined for detached trees.
  it("no-ops when there is no document content", () => {
    const handlers = makeChipHighlightHandlers(undefined, "var-emg", "chip-1");
    expect(() => {
      handlers.onMouseEnter();
      handlers.onMouseLeave();
      handlers.onClick();
    }).not.toThrow();
  });

  it("no-ops when there is no variable reference", () => {
    const content = emptyContent();
    const handlers = makeChipHighlightHandlers(content, undefined, "chip-1");

    handlers.onMouseEnter();
    handlers.onClick();
    expect(content.highlightRef).toBeUndefined();
  });

  it("one chip's mouseleave does not clobber another chip's active preview", () => {
    const content = emptyContent();
    const emg = makeChipHighlightHandlers(content, "var-emg", "chip-emg");
    const other = makeChipHighlightHandlers(content, "var-gripper", "chip-gripper");

    emg.onMouseEnter();
    other.onMouseLeave();

    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-emg" });
  });
});

// Called from VariableComponent's unmount-cleanup effect: React does not fire onMouseLeave for an
// element that unmounts under the cursor, and clicking the chip is the only way to unpin, so a
// chip that disappears while pinned would strand the highlight for the rest of the session.
describe("releaseOwnHighlightRefs", () => {
  it("clears a pinned highlight the chip owns", () => {
    const content = emptyContent();
    makeChipHighlightHandlers(content, "var-emg", "chip-1").onClick();

    releaseOwnHighlightRefs(content, "chip-1");

    expect(content.highlightRef).toBeUndefined();
  });

  it("clears a hovered highlight the chip owns", () => {
    const content = emptyContent();
    makeChipHighlightHandlers(content, "var-emg", "chip-1").onMouseEnter();

    releaseOwnHighlightRefs(content, "chip-1");

    expect(content.highlightRef).toBeUndefined();
  });

  it("clears both when the chip owns the pin and is also being hovered", () => {
    const content = emptyContent();
    const handlers = makeChipHighlightHandlers(content, "var-emg", "chip-1");
    handlers.onClick();
    handlers.onMouseEnter();

    releaseOwnHighlightRefs(content, "chip-1");

    expect(content.highlightRef).toBeUndefined();
  });

  // The bug this ownership model exists to fix. Reported against a duplicated text tile: pin from
  // one chip, delete the tile containing the other, and the highlight went dark everywhere even
  // though the chip the user actually clicked was still on screen. Ownership by reference cannot
  // tell these two apart, because a variable reference names no chip.
  it("leaves a pin alone when another chip citing the SAME variable unmounts", () => {
    const content = emptyContent();
    makeChipHighlightHandlers(content, "var-emg", "chip-clicked").onClick();

    releaseOwnHighlightRefs(content, "chip-elsewhere");

    expect(content.highlightState).toBe("pinned");
    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-emg" });
  });

  it("leaves a pin belonging to a different variable alone", () => {
    const content = emptyContent();
    makeChipHighlightHandlers(content, "var-gripper", "chip-gripper").onClick();

    releaseOwnHighlightRefs(content, "chip-emg");

    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-gripper" });
  });

  // The invariant: a highlight set with no source token is owned by nobody, so no source's
  // own-release may take it — including a release that also passes no token.
  it("leaves a highlight with no source alone", () => {
    const content = emptyContent();
    content.setPinnedHighlightRef({ kind: "variable", variableId: "var-emg" });

    releaseOwnHighlightRefs(content, undefined);
    releaseOwnHighlightRefs(content, "chip-1");

    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-emg" });
  });

  it("no-ops when there is no document content", () => {
    expect(() => releaseOwnHighlightRefs(undefined, "chip-1")).not.toThrow();
  });
});
