import { when } from "mobx";
import { Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import { TreeManager } from "../../../models/history/tree-manager";
import { registerTileTypes } from "../../../register-tile-types";
import { defaultSimulationKey } from "../simulations/simulations";
import { SimulatorContentModelType } from "./simulator-content";

registerTileTypes(["Simulator"]);

describe("SimulatorContentModel", () => {
  it("records a step as a background entry owned by its tile", async () => {
    const docModel = createDocumentModel({
      uid: "1", type: ProblemDocument, key: "test",
      content: {
        tiles: [{ id: "sim1", content: { type: "Simulator", simulation: defaultSimulationKey } }]
      } as any
    });
    docModel.treeMonitor!.enableMonitoring();
    const treeManager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
    const content = docModel.content!.tileMap.get("sim1")!.content as SimulatorContentModelType;

    content.step();
    const { history } = treeManager.document;
    await when(() => history.some(entry => entry.action?.endsWith("/step") && entry.state === "complete"),
      { timeout: 5000 });

    const step = history.find(entry => entry.action?.endsWith("/step"))!;
    expect(step.background).toBe(true);
    expect(step.producerTileId).toBe("sim1");
  });
});
