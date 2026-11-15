import { getSnapshot } from "mobx-state-tree";

import { registerTileTypes } from "../../../register-tile-types";
import { specAppConfig } from "../../stores/spec-app-config";
import { createDocumentModelWithEnv } from "../document";
import { ProblemDocument } from "../document-types";
import { DataflowContentModelType } from "../../../plugins/dataflow/model/dataflow-content";

// The copy paths log copy events, which need a Logger context these model tests don't set up.
jest.mock("../../tiles/log/log-tile-copy-event", () => ({
  logTileCopyEvent: () => undefined
}));
jest.mock("../../tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (_event: any, _params: any, runBeforeContainerLogging?: () => void) => {
    runBeforeContainerLogging?.();
  }
}));
jest.mock("../log-document-event", () => ({
  logDocumentEvent: () => undefined
}));

describe("DocumentContentModel -- copying a DataFlow tile --", () => {
  beforeAll(() => registerTileTypes(["Dataflow"]));

  it("gives the copy the Live Output config of the document's unit", () => {
    const appConfig = specAppConfig({
      config: { settings: { dataflow: { servoInputMode: "proportion", liveOutputTypes: ["Servo"] } } }
    });
    const document = createDocumentModelWithEnv(appConfig, {
      type: ProblemDocument, uid: "1", key: "test", createdAt: 1, content: {}, visibility: "public"
    });
    const content = document.content!;
    const sourceId = document.addTile("dataflow")!.tileId;
    // A tile made in another unit, or before the unit's settings changed, has another config.
    (content.getTile(sourceId)!.content as DataflowContentModelType)
      .setOutputConfig({ allowedOutputTypes: ["Fan"] });

    content.duplicateTiles(content.getDragTileItems([sourceId]));

    const [copyId] = content.getTilesOfType("Dataflow").filter(id => id !== sourceId);
    expect(getSnapshot(content.getTile(copyId)!.content as DataflowContentModelType).outputConfig)
      .toEqual({ servoInputMode: "proportion", allowedOutputTypes: ["Servo"] });
  });
});
