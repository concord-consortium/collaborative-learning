// The emphasis class is derived from objectHighlightState, and the emphasis -> class-name mapping is
// shared as highlightClassesFor (models/highlights) so it can be unit tested directly. Rendering CustomDataflowNode
// itself requires a full rete editor + area plugin, which is not worth standing up here; the
// rendered result is covered by Cypress in highlight_references_spec.js.
import { DocumentContentModel, DocumentContentSnapshotType } from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";
import { highlightClassesFor } from "../../../models/highlights/highlight-classes";

registerTileTypes(["Dataflow"]);

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

describe("Dataflow node highlight wiring", () => {
  it("reports the emphasis state for a targeted node", () => {
    const content = createDocumentContentModel({
      tiles: [{ id: "df1", content: { type: "Dataflow" } as any }]
    });
    content.setPinnedHighlightRef({ kind: "object", tileId: "df1", objectId: "node-1" });
    expect(content.objectHighlightState("df1", "node-1")).toBe("pinned");
    expect(content.objectHighlightState("df1", "node-2")).toBeUndefined();
  });
});

describe("highlightClassesFor", () => {
  it("returns highlight-pinned for pinned emphasis", () => {
    expect(highlightClassesFor("pinned")).toEqual({
      "highlight-pinned": true,
      "highlight-preview": false,
    });
  });

  it("returns highlight-preview for preview emphasis", () => {
    expect(highlightClassesFor("preview")).toEqual({
      "highlight-pinned": false,
      "highlight-preview": true,
    });
  });

  it("returns neither class when there is no emphasis", () => {
    expect(highlightClassesFor(undefined)).toEqual({
      "highlight-pinned": false,
      "highlight-preview": false,
    });
  });
});
