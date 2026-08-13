// The chip's handlers are extracted into makeChipHighlightHandlers, and the shared clear-if-own
// guard into clearHoveredHighlightRefIfOwn, so they can be tested without standing up a Slate editor.
// The rendered interaction (that the handlers are actually attached to the right element, and
// that unmounting a hovered chip clears its preview) is covered by Cypress in
// highlight_references_spec.js.
import "../../../models/document/document-content-tests/dc-test-utils";
import {
  DocumentContentModel, DocumentContentSnapshotType
} from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";
import { clearHoveredHighlightRefIfOwn, makeChipHighlightHandlers, releaseOwnHighlightRefs } from "./variables-plugin";

registerTileTypes(["Text"]);

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

describe("makeChipHighlightHandlers", () => {
  it("previews on mouse-enter and clears on mouse-leave", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const handlers = makeChipHighlightHandlers(content, "var-emg");

    handlers.onMouseEnter();
    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-emg" });
    expect(content.highlightState).toBe("preview");

    handlers.onMouseLeave();
    expect(content.highlightRef).toBeUndefined();
  });

  it("pins on click and unpins on a second click", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const handlers = makeChipHighlightHandlers(content, "var-emg");

    handlers.onClick();
    expect(content.highlightState).toBe("pinned");

    handlers.onClick();
    expect(content.highlightRef).toBeUndefined();
  });

  it("lets a hovered chip take over from a pinned one, then restores the pin", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const emg = makeChipHighlightHandlers(content, "var-emg");
    const gripper = makeChipHighlightHandlers(content, "var-gripper");

    emg.onClick();
    gripper.onMouseEnter();
    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-gripper" });

    gripper.onMouseLeave();
    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-emg" });
  });

  // A chip whose element has no reference, or that lives in a detached tree, must no-op rather
  // than throw. getDocumentContentFromNode returns undefined for detached trees.
  it("no-ops when there is no document content", () => {
    const handlers = makeChipHighlightHandlers(undefined, "var-emg");
    expect(() => {
      handlers.onMouseEnter();
      handlers.onMouseLeave();
      handlers.onClick();
    }).not.toThrow();
  });

  it("no-ops when there is no variable reference", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const handlers = makeChipHighlightHandlers(content, undefined);

    handlers.onMouseEnter();
    handlers.onClick();
    expect(content.highlightRef).toBeUndefined();
  });

  // A chip may only clear the preview it owns: several chips share one document, so an
  // unconditional clear would let any chip wipe another's.
  it("a malformed chip's mouseleave does not clobber another chip's active preview", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const emg = makeChipHighlightHandlers(content, "var-emg");
    const malformed = makeChipHighlightHandlers(content, undefined);

    emg.onMouseEnter();
    malformed.onMouseLeave();

    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-emg" });
  });
});

// clearHoveredHighlightRefIfOwn is also called from VariableComponent's unmount-cleanup effect (React
// does not fire onMouseLeave for an element that unmounts under the cursor, e.g. Backspace
// deleting a hovered chip). It is exercised directly here rather than by mounting a Slate editor.
describe("clearHoveredHighlightRefIfOwn", () => {
  it("clears the hoveredHighlightRef when it still points at this chip's variable", () => {
    const content = createDocumentContentModel({ tiles: [] });
    content.setHoveredHighlightRef({ kind: "variable", variableId: "var-emg" });

    clearHoveredHighlightRefIfOwn(content, "var-emg");

    expect(content.highlightRef).toBeUndefined();
  });

  it("does not clobber a different chip's active preview", () => {
    const content = createDocumentContentModel({ tiles: [] });
    content.setHoveredHighlightRef({ kind: "variable", variableId: "var-gripper" });

    clearHoveredHighlightRefIfOwn(content, "var-emg");

    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-gripper" });
  });

  it("no-ops when variableId is undefined", () => {
    const content = createDocumentContentModel({ tiles: [] });
    content.setHoveredHighlightRef({ kind: "variable", variableId: "var-gripper" });

    clearHoveredHighlightRefIfOwn(content, undefined);

    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-gripper" });
  });

  it("no-ops when there is no document content", () => {
    expect(() => clearHoveredHighlightRefIfOwn(undefined, "var-emg")).not.toThrow();
  });
});

describe("releaseOwnHighlightRefs", () => {
  // Clicking the chip is the only way to unpin, so a pin whose chip has been deleted can never
  // be dismissed. Unmount has to release the pin as well as the preview.
  it("clears a pinned highlight the chip owns", () => {
    const content = createDocumentContentModel({ tiles: [] });
    content.setPinnedHighlightRef({ kind: "variable", variableId: "var-emg" });

    releaseOwnHighlightRefs(content, "var-emg");

    expect(content.highlightRef).toBeUndefined();
  });

  it("clears a hovered highlight the chip owns", () => {
    const content = createDocumentContentModel({ tiles: [] });
    content.setHoveredHighlightRef({ kind: "variable", variableId: "var-emg" });

    releaseOwnHighlightRefs(content, "var-emg");

    expect(content.highlightRef).toBeUndefined();
  });

  it("clears both when the chip owns the pin and is also being hovered", () => {
    const content = createDocumentContentModel({ tiles: [] });
    content.setPinnedHighlightRef({ kind: "variable", variableId: "var-emg" });
    content.setHoveredHighlightRef({ kind: "variable", variableId: "var-emg" });

    releaseOwnHighlightRefs(content, "var-emg");

    expect(content.highlightRef).toBeUndefined();
  });

  it("leaves a pin belonging to a different variable alone", () => {
    const content = createDocumentContentModel({ tiles: [] });
    content.setPinnedHighlightRef({ kind: "variable", variableId: "var-gripper" });

    releaseOwnHighlightRefs(content, "var-emg");

    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-gripper" });
  });

  it("no-ops when variableId is undefined or there is no document content", () => {
    const content = createDocumentContentModel({ tiles: [] });
    content.setPinnedHighlightRef({ kind: "variable", variableId: "var-gripper" });

    releaseOwnHighlightRefs(content, undefined);
    expect(content.highlightRef).toEqual({ kind: "variable", variableId: "var-gripper" });

    expect(() => releaseOwnHighlightRefs(undefined, "var-emg")).not.toThrow();
  });
});
