// The chip's handlers are extracted into makeChipHighlightHandlers so they can be tested
// without standing up a Slate editor. The rendered interaction (that the handlers are actually
// attached to the right element) is covered by Cypress in Task 7.
import "../../../models/document/document-content-tests/dc-test-utils";
import {
  DocumentContentModel, DocumentContentSnapshotType
} from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";
import { makeChipHighlightHandlers } from "./variables-plugin";

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
    expect(content.activeRef).toEqual({ kind: "variable", variableId: "var-emg" });
    expect(content.activeSource).toBe("preview");

    handlers.onMouseLeave();
    expect(content.activeRef).toBeUndefined();
  });

  it("pins on click and unpins on a second click", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const handlers = makeChipHighlightHandlers(content, "var-emg");

    handlers.onClick();
    expect(content.activeSource).toBe("pinned");

    handlers.onClick();
    expect(content.activeRef).toBeUndefined();
  });

  it("lets a hovered chip take over from a pinned one, then restores the pin", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const emg = makeChipHighlightHandlers(content, "var-emg");
    const gripper = makeChipHighlightHandlers(content, "var-gripper");

    emg.onClick();
    gripper.onMouseEnter();
    expect(content.activeRef).toEqual({ kind: "variable", variableId: "var-gripper" });

    gripper.onMouseLeave();
    expect(content.activeRef).toEqual({ kind: "variable", variableId: "var-emg" });
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
    expect(content.activeRef).toBeUndefined();
  });
});
