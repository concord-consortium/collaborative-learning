// The emphasis class is derived from objectState, and the emphasis -> class-name mapping is
// exported as highlightClassesFor so it can be unit tested directly. Rendering CustomDataflowNode
// itself requires a full rete editor + area plugin, which is not worth standing up here; the
// rendered result is covered by Cypress in highlight_references_spec.js.
import { getTileIdFromNode } from "../../../utilities/mst-utils";
import { DocumentContentModel, DocumentContentSnapshotType } from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";
import { highlightClassesFor } from "./dataflow-node";

registerTileTypes(["Dataflow"]);

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

describe("Dataflow node highlight wiring", () => {
  it("finds the containing tile id from a node model", () => {
    const content = createDocumentContentModel({
      tiles: [{ id: "df1", content: { type: "Dataflow" } as any }]
    });
    const dataflowContent = content.getTileContent("df1") as any;
    dataflowContent.program.addNodeSnapshot({
      id: "node-1", name: "Number", x: 0, y: 0, data: { type: "Number", nodeValue: 1 }
    } as any);
    const node = dataflowContent.program.nodes.get("node-1");
    expect(getTileIdFromNode(node.data)).toBe("df1");
  });

  it("reports the emphasis state for a targeted node", () => {
    const content = createDocumentContentModel({
      tiles: [{ id: "df1", content: { type: "Dataflow" } as any }]
    });
    content.setPinnedRef({ kind: "object", tileId: "df1", objectId: "node-1" });
    expect(content.objectState("df1", "node-1")).toBe("pinned");
    expect(content.objectState("df1", "node-2")).toBeUndefined();
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
