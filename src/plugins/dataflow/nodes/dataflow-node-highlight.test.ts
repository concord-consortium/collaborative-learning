// The emphasis class is derived from objectState, which is what this test pins down. Rendering
// CustomDataflowNode itself requires a full rete editor + area plugin, which is not worth
// standing up for a class-name mapping; the rendered result is covered by Cypress in Task 7.
import { getTileIdFromNode } from "../../../utilities/mst-utils";
import { DocumentContentModel, DocumentContentSnapshotType } from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";

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
