import { Instance, flow, getType, types, unprotect } from "mobx-state-tree";
import { deferred } from "promise-assist";
import { createDocumentModel } from "../document/document";
import { DocumentContentModel } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { SharedModel } from "../shared/shared-model";
import { registerSharedModelInfo } from "../shared/shared-model-registry";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { TileContentModel } from "../tiles/tile-content";
import { FAKE_HISTORY_ENTRY_ID, TreeManager } from "./tree-manager";
import { asBackground } from "./without-undo";

const TestSharedModel = SharedModel
  .named("TestSharedModel")
  .props({
    type: "TestSharedModel",
    value: types.maybe(types.string)
  })
  .actions(self => ({
    setValue(value: string) {
      self.value = value;
    }
  }));
interface TestSharedModelType extends Instance<typeof TestSharedModel> {}

registerSharedModelInfo({
  type: "TestSharedModel",
  modelClass: TestSharedModel,
  hasName: false
});

// Called by the test tile's updateAfterSharedModelChanges once it has changed the tile
let onSharedModelUpdate: (() => void) | undefined;

const TestTile = TileContentModel
  .named("TestTile")
  .props({
    type: "TestTile",
    text: types.maybe(types.string),
  })
  .views(self => ({
    get sharedModel() {
      const sharedModel = self.tileEnv?.sharedModelManager?.getTileSharedModels(self)?.[0];
      return sharedModel && getType(sharedModel) === TestSharedModel
        ? sharedModel as TestSharedModelType
        : undefined;
    }
  }))
  .actions(self => ({
    updateAfterSharedModelChanges() {
      if (!self.sharedModel?.value) return;
      self.text = `${self.sharedModel.value}-tile`;
      onSharedModelUpdate?.();
    },
    setSharedValue(value: string) {
      self.sharedModel?.setValue(value);
    },
    tickSharedValue(value: string) {
      asBackground({ producerTileId: "t1" });
      self.sharedModel?.setValue(value);
    },
    setText(value: string) {
      self.text = value;
    },
    setTextThenThrow(value: string) {
      self.text = value;
      throw new Error("failed after changing state");
    },
    setTextLater: flow(function* (value: string, gate: Promise<void>) {
      yield gate;
      self.text = value;
      yield gate;
    }),
    waitWithoutChanging: flow(function* (gate: Promise<void>) {
      yield gate;
    }),
    changeNothing() {
      // An action that records an empty patch record
    },
    tickText(value: string) {
      asBackground({ producerTileId: "t1" });
      self.text = value;
    },
    tickTextLater: flow(function* (value: string, gate: Promise<void>) {
      asBackground({ producerTileId: "t1" });
      yield gate;
      self.text = value;
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

function setupDocument(options?: { withSharedModel?: boolean }) {
  const docContent = DocumentContentModel.create({
    ...(options?.withSharedModel && {
      sharedModelMap: {
        "sm1": { sharedModel: { id: "sm1", type: "TestSharedModel" }, tiles: [ "t1" ] }
      }
    }),
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

  describe("finished calls", () => {
    // The exchange of the open entry for the call to `action`, once the call has finished.
    function exchangeOf(treeManager: Instance<typeof TreeManager>, action: string) {
      const entry = treeManager.activeHistoryEntries.find(e => e.action === `/content/tileMap/t1/content/${action}`);
      return Array.from(entry!.activeExchanges.keys())[0];
    }

    it("knows a finished call until its record reaches the manager, and whether it changed the tree", async () => {
      const { tileContent, treeMonitor, treeManager } = setupDocument();
      tileContent.changeNothing();
      const unchanged = exchangeOf(treeManager, "changeNothing");
      expect(treeMonitor.isFinishedCallExchange(unchanged)).toBe(true);
      expect(treeMonitor.hasCallWithUnrecordedChanges()).toBe(false);

      tileContent.setText("x");
      const changed = exchangeOf(treeManager, "setText");
      expect(treeMonitor.isFinishedCallExchange(changed)).toBe(true);
      expect(treeMonitor.hasCallWithUnrecordedChanges()).toBe(true);

      await new Promise(resolve => setTimeout(resolve));
      expect(treeManager.activeHistoryEntries).toHaveLength(0);
      expect(treeMonitor.isFinishedCallExchange(unchanged)).toBe(false);
      expect(treeMonitor.isFinishedCallExchange(changed)).toBe(false);
      expect(treeMonitor.hasCallWithUnrecordedChanges()).toBe(false);
    });

    it("forgets a finished call whose record returns early without reaching the manager", async () => {
      const { tileContent, treeMonitor } = setupDocument();
      jest.spyOn(treeMonitor as unknown as { recordAction: () => Promise<void> }, "recordAction")
        .mockResolvedValue(undefined);
      tileContent.setText("x");
      expect(treeMonitor.hasCallWithUnrecordedChanges()).toBe(true);
      await new Promise(resolve => setTimeout(resolve));
      expect(treeMonitor.hasCallWithUnrecordedChanges()).toBe(false);
    });

    it("counts a running flow that has changed the tree as unrecorded changes", async () => {
      const { tileContent, treeMonitor } = setupDocument();
      const first = deferred<void>();
      const second = deferred<void>();
      let step = 0;
      const gate = {
        then: (resolve: () => void) => {
          (step++ === 0 ? first : second).promise.then(resolve);
        }
      } as unknown as Promise<void>;

      const promise = tileContent.setTextLater("x", gate);
      expect(treeMonitor.hasCallWithUnrecordedChanges()).toBe(false);
      first.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(treeMonitor.hasCallWithUnrecordedChanges()).toBe(true);
      second.resolve();
      await promise;
    });
  });

  describe("background calls", () => {
    afterEach(() => { onSharedModelUpdate = undefined; });

    it("knows a finished background call's changes are all background until its record reaches the manager",
        async () => {
      const { tileContent, treeMonitor } = setupDocument();
      tileContent.tickText("a");
      expect(treeMonitor.areUnrecordedChangesAllBackground()).toBe(true);

      await new Promise(resolve => setTimeout(resolve));
      expect(treeMonitor.areUnrecordedChangesAllBackground()).toBe(false);
    });

    it("knows a running background flow's changes are all background", async () => {
      const { tileContent, treeMonitor } = setupDocument();
      const first = deferred<void>();
      const second = deferred<void>();
      let step = 0;
      const gate = {
        then: (resolve: () => void) => {
          (step++ === 0 ? first : second).promise.then(resolve);
        }
      } as unknown as Promise<void>;

      const promise = tileContent.tickTextLater("x", gate);
      first.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(treeMonitor.getRunningCallsWithChanges()).toHaveLength(1);
      expect(treeMonitor.areUnrecordedChangesAllBackground()).toBe(true);
      second.resolve();
      await promise;
    });

    it("doesn't count a user call's changes as background", () => {
      const { tileContent, treeMonitor } = setupDocument();
      tileContent.setText("a");
      expect(treeMonitor.areUnrecordedChangesAllBackground()).toBe(false);
    });

    it("doesn't count changes as all background when a user call follows a background one", () => {
      const { tileContent, treeMonitor } = setupDocument();
      tileContent.tickText("a");
      tileContent.setText("b");
      expect(treeMonitor.areUnrecordedChangesAllBackground()).toBe(false);
    });

    it("counts a background call's shared model follow-up as background until its records reach the manager",
        async () => {
      const { tileContent, treeMonitor, treeManager } = setupDocument({ withSharedModel: true });
      const duringFollowUp: boolean[] = [];
      onSharedModelUpdate = () => {
        duringFollowUp.push(treeMonitor.areUnrecordedChangesAllBackground());
      };

      tileContent.tickSharedValue("a");
      expect(treeMonitor.areUnrecordedChangesAllBackground()).toBe(true);
      await new Promise(resolve => setTimeout(resolve));
      expect(tileContent.text).toBe("a-tile");
      expect(duringFollowUp).toEqual([true]);
      expect(treeMonitor.areUnrecordedChangesAllBackground()).toBe(false);

      const history = treeManager.document.history;
      expect(history).toHaveLength(1);
      expect(history[0].background).toBe(true);
      expect(history[0].records.flatMap(record => record.patches.map(patch => patch.path)))
        .toContain("/content/tileMap/t1/content/text");
    });

    it("doesn't count a user call's shared model follow-up as background", async () => {
      const { tileContent, treeMonitor, treeManager } = setupDocument({ withSharedModel: true });
      const duringFollowUp: boolean[] = [];
      onSharedModelUpdate = () => {
        duringFollowUp.push(treeMonitor.areUnrecordedChangesAllBackground());
      };

      tileContent.setSharedValue("a");
      await new Promise(resolve => setTimeout(resolve));
      expect(duringFollowUp).toEqual([false]);
      expect(treeManager.document.history[0].background).toBeUndefined();
    });

    it("is false with nothing pending", () => {
      const { treeMonitor } = setupDocument();
      expect(treeMonitor.areUnrecordedChangesAllBackground()).toBe(false);
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

    it("doesn't report the rollback of a failed action", () => {
      const { tileContent, treeMonitor, treeManager } = setupDocument();
      const onUnrecordedChange = jest.fn();
      treeMonitor.onUnrecordedChange = onUnrecordedChange;

      expect(() => tileContent.setTextThenThrow("x")).toThrow("failed after changing state");
      expect(tileContent.text).toBeUndefined();
      expect(onUnrecordedChange).not.toHaveBeenCalled();
      expect(treeManager.exactness.notExactReason).toBeUndefined();
    });

    it("doesn't report patches from a call with the fake history entry id", () => {
      const { docModel, tileContent, treeMonitor, treeManager } = setupDocument();
      const onUnrecordedChange = jest.fn();
      treeMonitor.onUnrecordedChange = onUnrecordedChange;

      docModel.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, "exchange", [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "remote" }
      ]);
      expect(tileContent.text).toBe("remote");
      expect(onUnrecordedChange).not.toHaveBeenCalled();
      expect(treeManager.exactness.notExactReason).toBeUndefined();
    });
  });
});
