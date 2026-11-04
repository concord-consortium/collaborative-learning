import { Instance, flow, types, unprotect } from "mobx-state-tree";
import { deferred } from "promise-assist";
import { createDocumentModel } from "../document/document";
import { DocumentContentModel } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { TileContentModel } from "../tiles/tile-content";
import { TreeManager } from "./tree-manager";

const TestTile = TileContentModel
  .named("TestTile")
  .props({
    type: "TestTile",
    text: types.maybe(types.string),
  })
  .actions(self => ({
    setText(value: string) {
      self.text = value;
    },
    setTextLater: flow(function* (value: string, gate: Promise<void>) {
      yield gate;
      self.text = value;
      yield gate;
    }),
    waitWithoutChanging: flow(function* (gate: Promise<void>) {
      yield gate;
    })
  }));
interface TestTileType extends Instance<typeof TestTile> {}

registerTileContentInfo({
  type: "TestTile",
  modelClass: TestTile,
  defaultContent() {
    return TestTile.create();
  }
});
registerTileComponentInfo({
  type: "TestTile",
  Component: () => { throw new Error("Component not implemented."); },
  tileEltClass: "test-tile"
});

function setupDocument() {
  const docContent = DocumentContentModel.create({
    tileMap: {
      "t1": { id: "t1", content: { type: "TestTile" } }
    }
  });
  const docModel = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    content: docContent as any
  });
  const treeMonitor = docModel.treeMonitor!;
  treeMonitor.enableMonitoring();
  const tileContent = docContent.tileMap.get("t1")?.content as TestTileType;
  const treeManager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  return { docModel, docContent, tileContent, treeMonitor, treeManager };
}

describe("TreeMonitor", () => {
  describe("running calls", () => {
    it("counts a flow as running from spawn to return", async () => {
      const { tileContent, treeMonitor } = setupDocument();
      const gate = deferred<void>();
      expect(treeMonitor.runningCallCount).toBe(0);

      const promise = tileContent.setTextLater("x", gate.promise);
      expect(treeMonitor.runningCallCount).toBe(1);

      gate.resolve();
      await promise;
      expect(treeMonitor.runningCallCount).toBe(0);
    });

    it("lists a running flow only once it has changed state", async () => {
      const { tileContent, treeMonitor } = setupDocument();
      const first = deferred<void>();
      const second = deferred<void>();
      let step = 0;
      // The flow waits on this gate twice, with a change between the waits
      const gate = {
        then: (resolve: () => void) => {
          (step++ === 0 ? first : second).promise.then(resolve);
        }
      } as unknown as Promise<void>;

      const promise = tileContent.setTextLater("x", gate);
      expect(treeMonitor.getRunningCallsWithChanges()).toEqual([]);

      first.resolve();
      await Promise.resolve();
      await Promise.resolve();
      const running = treeMonitor.getRunningCallsWithChanges();
      expect(running).toHaveLength(1);
      expect(running[0].action).toMatch(/setTextLater$/);
      expect(typeof running[0].historyEntryId).toBe("string");

      second.resolve();
      await promise;
      expect(treeMonitor.getRunningCallsWithChanges()).toEqual([]);
    });

    it("doesn't list a running flow that changes nothing", async () => {
      const { tileContent, treeMonitor } = setupDocument();
      const gate = deferred<void>();
      const promise = tileContent.waitWithoutChanging(gate.promise);
      expect(treeMonitor.runningCallCount).toBe(1);
      expect(treeMonitor.getRunningCallsWithChanges()).toEqual([]);
      gate.resolve();
      await promise;
    });
  });

  describe("unrecorded changes", () => {
    it("reports a patch made while monitoring is enabled and nothing is tracked", () => {
      const { docModel, docContent, treeMonitor } = setupDocument();
      const onUnrecordedChange = jest.fn();
      treeMonitor.onUnrecordedChange = onUnrecordedChange;
      unprotect(docModel);
      (docContent.tileMap.get("t1")!.content as TestTileType).text = "x";
      expect(onUnrecordedChange).toHaveBeenCalledTimes(1);
    });

    it("doesn't report patches from tracked actions, or while monitoring is disabled", () => {
      const { docModel, docContent, tileContent, treeMonitor } = setupDocument();
      const onUnrecordedChange = jest.fn();
      treeMonitor.onUnrecordedChange = onUnrecordedChange;

      tileContent.setText("tracked");
      expect(onUnrecordedChange).not.toHaveBeenCalled();

      treeMonitor.disableMonitoring();
      unprotect(docModel);
      (docContent.tileMap.get("t1")!.content as TestTileType).text = "untracked";
      expect(onUnrecordedChange).not.toHaveBeenCalled();
    });

    it("marks the session not exact on an unrecorded change", () => {
      const { docModel, docContent, treeManager } = setupDocument();
      expect(treeManager.exactness.notExactReason).toBeUndefined();
      unprotect(docModel);
      (docContent.tileMap.get("t1")!.content as TestTileType).text = "x";
      expect(treeManager.exactness.notExactReason).toBe("unrecorded-change");
    });
  });
});
