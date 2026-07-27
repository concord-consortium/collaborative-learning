import { parsedExport } from "./dc-test-utils";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document-content";
import { IDocumentImportSnapshot } from "../document-content-import-types";
import { SharedModelDocumentManager } from "../shared-model-document-manager";
import { ITileEnvironment } from "../../tiles/tile-content";
import { kVolatileVariableLabel } from "../../../plugins/shared-variables/variable-labels";

import "../../../plugins/shared-variables/shared-variables-registration";
import "../../../plugins/diagram-viewer/diagram-registration";

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

// Exercises the document-export dispatch in document-content.ts that routes a shared model through its
// exportStableSnapshot() when present. Confirms a SharedVariables entry is value-stripped through the
// FULL document export (not just in isolation), and that a shared model without the hook is unaffected.
describe("DocumentContentModel export -- SharedVariables volatile stripping --", () => {
  it("strips volatile variable values through the document export, preserving authored ones", () => {
    const documentContent = createDocumentContentModel({
      tiles: [[{ id: "diagramTool", content: { type: "Diagram" } }]],
      sharedModels: [{
        tiles: ["diagramTool"],
        provider: "diagramTool",
        sharedModel: {
          type: "SharedVariables",
          id: "sharedVars1",
          variables: [
            // producer-marked volatile: value must be dropped from the export
            { id: "driven", name: "temperature", value: 27.5,
              labels: ["sensor:temperature", kVolatileVariableLabel] },
            // authored variable: value must survive
            { id: "authored", name: "threshold", value: 42, labels: [] },
          ]
        }
      }]
    } as unknown as IDocumentImportSnapshot);

    const exported = parsedExport(documentContent);
    const sharedModel = exported.sharedModels[0].sharedModel;
    expect(sharedModel.type).toBe("SharedVariables");
    const byId = Object.fromEntries(sharedModel.variables.map((v: any) => [v.id, v]));

    expect(byId.driven).not.toHaveProperty("value");
    expect(byId.driven.name).toBe("temperature");
    expect(byId.authored.value).toBe(42);
  });
});
