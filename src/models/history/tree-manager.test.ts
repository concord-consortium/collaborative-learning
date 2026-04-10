import { nanoid } from "nanoid";
import { cloneDeep } from "lodash";
import { getSnapshot, getType, Instance, types } from "mobx-state-tree";
import { ITileProps } from "src/components/tiles/tile-component";
import { SharedModel, SharedModelType } from "../shared/shared-model";
import { registerSharedModelInfo } from "../shared/shared-model-registry";
import { TileContentModel } from "../tiles/tile-content";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { createDocumentModel } from "../document/document";
import { ProblemDocument } from "../document/document-types";
import { CDocument, TreeManager } from "./tree-manager";
import { HistoryEntrySnapshot } from "./history";
import { expectEntryToBeComplete } from "./undo-store-test-utils";

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

const TestTile = TileContentModel
  .named("TestTile")
  .props({
    type: "TestTile",
    text: types.maybe(types.string),
    flag: types.maybe(types.boolean),
    actionText: types.maybe(types.string)
  })
  .volatile(self => ({
    updateCount: 0
  }))
  .views(self => ({
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedModel = sharedModelManager?.getTileSharedModels(self)?.[0];
      if (!firstSharedModel || getType(firstSharedModel) !== TestSharedModel) {
        return undefined;
      }
      return firstSharedModel as TestSharedModelType;
    },
  }))
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      self.updateCount++;
      const sharedModelValue = self.sharedModel?.value;
      self.text = sharedModelValue ? `${sharedModelValue}-tile` : undefined;
    },
    setFlag(_flag: boolean) {
      self.flag = _flag;
    },
    setActionText(value: string) {
      self.actionText = value;
    }
  }));
interface TestTileType extends Instance<typeof TestTile> {}

const TestTileComponent: React.FC<ITileProps> = () => {
  throw new Error("Component not implemented.");
};

registerTileContentInfo({
  type: "TestTile",
  modelClass: TestTile,
  defaultContent(options) {
    return TestTile.create();
  }
});
registerTileComponentInfo({
  type: "TestTile",
  Component: TestTileComponent,
  tileEltClass: "test-tile"
});

function setupDocument(initialContent? : DocumentContentSnapshotType) {
  const docContentSnapshot = initialContent ||  {
    sharedModelMap: {
      "sm1": {
        sharedModel: {
          id: "sm1",
          type: "TestSharedModel"
        },
        tiles: [ "t1" ]
      }
    },
    tileMap: {
      "t1": {
        id: "t1",
        content: {
          type: "TestTile"
        },
      }
    }
  };
  const docContent = DocumentContentModel.create(docContentSnapshot);

  // This is needed to setup the tree monitor and shared model manager
  const docModel = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    content: docContent as any
  });

  docModel.treeMonitor!.enableMonitoring();

  const sharedModel = docContent.sharedModelMap.get("sm1")?.sharedModel as TestSharedModelType;
  const tileContent = docContent.tileMap.get("t1")?.content as TestTileType;
  const manager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  const undoStore = manager.undoStore;

  return {docContent, sharedModel, tileContent, manager, undoStore};
}

const updateFlag = {
  model: "TestTile",
  action: "/content/tileMap/t1/content/setFlag",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/content/tileMap/t1/content/setFlag",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: true}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "test",
  undoable: true
};

const action1 =   {
  model: "TestTile",
  action: "/content/tileMap/t1/content/setActionText",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/content/tileMap/t1/content/setActionText",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "action 1"}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "test",
  undoable: true
};

const action2 =   {
  model: "TestTile",
  action: "/content/tileMap/t1/content/setActionText",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/content/tileMap/t1/content/setActionText",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "action 1"}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "action 2"}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "test",
  undoable: true
};

const action3 = {
  model: "TestTile",
  action: "/content/tileMap/t1/content/setActionText",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/content/tileMap/t1/content/setActionText",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "action 2"}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "action 3"}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "test",
  undoable: true
};

const action4 = {
  model: "TestTile",
  action: "/content/tileMap/t1/content/setActionText",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/content/tileMap/t1/content/setActionText",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "action 3"}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "action 4"}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "test",
  undoable: true
};

const sharedModelChange = {
  "model": "TestSharedModel",
  "action": "/content/sharedModelMap/sm1/sharedModel/setValue",
  "created": expect.any(Number),
  "id": expect.any(String),
  "records": [
    {
      "action": "/content/sharedModelMap/sm1/sharedModel/setValue",
      "inversePatches": [
        {
          "op": "replace",
          "path": "/content/sharedModelMap/sm1/sharedModel/value",
          "value": undefined,
        },
      ],
      "patches": [
        {
          "op": "replace",
          "path": "/content/sharedModelMap/sm1/sharedModel/value",
          "value": "shared value",
        },
      ],
      "tree": "test",
    },
    {
      "action": "/handleSharedModelChanges",
      "inversePatches": [
        {
          "op": "replace",
          "path": "/content/tileMap/t1/content/text",
        },
      ],
      "patches": [
          {
          "op": "replace",
          "path": "/content/tileMap/t1/content/text",
          "value": "shared value-tile",
        },
      ],
      "tree": "test",
    }
  ],
  "state": "complete",
  "tree": "test",
  "undoable": true,
};



/**
 * Remove the Jest `expect.any(Number)` on created, and provide a real id.
 * @param entry
 * @returns
 */
function makeRealHistoryEntry(entry: any): HistoryEntrySnapshot {
  const realEntry = cloneDeep(entry);
  realEntry.created = Date.now();
  realEntry.id = nanoid();
  return realEntry;
}

const mockCreateFirestoreMetadataDocument_v2 = jest.fn();
const mockPostDocumentComment_v2 = jest.fn();
const mockHttpsCallable = jest.fn((fn: string) => {
  switch(fn) {
    case "createFirestoreMetadataDocument_v2":
      return mockCreateFirestoreMetadataDocument_v2;
    case "postDocumentComment_v2":
      return mockPostDocumentComment_v2;
  }
});
jest.mock("firebase/app", () => ({
  functions: () => ({
    httpsCallable: (fn: string) => mockHttpsCallable(fn)
  })
}));

it("records multiple history entries", async () => {
  const {tileContent, manager} = setupDocument();
  tileContent.setFlag(true);
  tileContent.setActionText("action 1");
  tileContent.setActionText("action 2");
  tileContent.setActionText("action 3");
  tileContent.setActionText("action 4");

  const changeDocument: Instance<typeof CDocument> = manager.document;
  await expectEntryToBeComplete(manager, 5);

  expect(getSnapshot(changeDocument.history)).toEqual([
    updateFlag, action1, action2, action3, action4 ]);
});

it("can replay the history entries", async () => {
  const {tileContent, manager} = setupDocument();
  const history = [
    makeRealHistoryEntry(updateFlag),
    makeRealHistoryEntry(action1),
    makeRealHistoryEntry(action2),
    makeRealHistoryEntry(action3),
    makeRealHistoryEntry(action4),
  ];

  manager.setChangeDocument(CDocument.create({history}));
  await manager.replayHistoryToTrees();

  expect(tileContent.flag).toBe(true);
  expect(tileContent.actionText).toEqual("action 4");

  manager.setNumHistoryEntriesApplied(manager.document.history.length);
  expect(manager.numHistoryEventsApplied).toBe(5);

  await manager.goToHistoryEntry(2);
  expect(tileContent.actionText).toBe("action 1");

  // The history should not change after it is replayed
  expect(getSnapshot(manager.document.history)).toEqual(history);
});

// A history entry containing a patch that references a non-existent tile.
// Both the forward patch and the inverse patch target the missing path,
// so replaying this entry fails in either direction.
const failingEntry = {
  model: "TestTile",
  action: "/injectedFailingEntry",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/injectedFailingEntry",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/NONEXISTENT/content/flag", value: false}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/NONEXISTENT/content/flag", value: true}
      ],
      tree: "test"
    },
  ],
  state: "complete",
  tree: "test",
  undoable: true
};

// An entry with three records for the same tree. The bad record is
// sandwiched between two good records so that in either direction, at
// least one good record's patches are applied before the bad record
// fails — exercising the rollback logic in both directions.
const mixedEntry = {
  model: "TestTile",
  action: "/mixedEntry",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/mixedEntry",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "initial"}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "good first"}
      ],
      tree: "test"
    },
    { action: "/mixedEntry",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/NONEXISTENT/content/flag", value: false}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/NONEXISTENT/content/flag", value: true}
      ],
      tree: "test"
    },
    { action: "/mixedEntry",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: true}
      ],
      tree: "test"
    }
  ],
  state: "complete",
  tree: "test",
  undoable: true
};

// An entry with a single record containing three patches: a good patch,
// a bad patch (non-existent tile), and another good patch. Sandwiching
// the bad patch ensures that in either direction at least one good
// patch is applied before the bad patch fails.
const mixedPatchesEntry = {
  model: "TestTile",
  action: "/mixedPatchesEntry",
  created: expect.any(Number),
  id: expect.any(String),
  records: [
    { action: "/mixedPatchesEntry",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "initial"},
        { op: "replace", path: "/content/tileMap/NONEXISTENT/content/flag", value: false},
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: undefined}
      ],
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/actionText", value: "good patch first"},
        { op: "replace", path: "/content/tileMap/NONEXISTENT/content/flag", value: true},
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: true}
      ],
      tree: "test"
    }
  ],
  state: "complete",
  tree: "test",
  undoable: true
};

/**
 * Seed the manager with a given history and corresponding tree state,
 * positioned at a given numHistoryEventsApplied. The `setState` callback
 * can make any tile state changes needed to match the "already applied"
 * position. The callback's actions will be recorded by the middleware
 * temporarily, but we reset the change document afterwards to clear
 * that recording.
 */
function seedHistory(
  manager: Instance<typeof TreeManager>,
  history: HistoryEntrySnapshot[],
  numApplied: number,
  setState?: () => void
) {
  setState?.();
  manager.setChangeDocument(CDocument.create({history}));
  manager.setNumHistoryEntriesApplied(numApplied);
}

describe("history playback failure handling", () => {
  // History: [action1, failingEntry, action2]. Scrubbing forward across
  // failingEntry from position 1 should stop at position 1 and record
  // a redo failure. Scrubbing backward across failingEntry from position
  // 3 should stop at position 2 and record an undo failure.
  const historyWithFailingEntry = [
    makeRealHistoryEntry(action1),
    makeRealHistoryEntry(failingEntry),
    makeRealHistoryEntry(action2),
  ];

  it("records a failure and stops replay when scrubbing forward past a failing entry", async () => {
    const {tileContent, manager} = setupDocument();
    seedHistory(manager, historyWithFailingEntry, 1, () => tileContent.setActionText("action 1"));

    // Scrub forward past the failing entry
    await manager.goToHistoryEntry(3);

    // Should have stopped at the failing entry without applying action2
    expect(manager.numHistoryEventsApplied).toBe(1);
    expect(tileContent.actionText).toBe("action 1");
    expect(manager.historyPlaybackFailures.length).toBe(1);
    expect(manager.historyPlaybackFailures[0].historyIndex).toBe(1);
    expect(manager.historyPlaybackFailures[0].direction).toBe("redo");
  });

  it("records a failure and stops replay when scrubbing backward past a failing entry", async () => {
    const {tileContent, manager} = setupDocument();
    // Seed at position 3 (all entries applied) with actionText = "action 2"
    // so the tree state matches what it would be if the history had been
    // played forward successfully.
    seedHistory(manager, historyWithFailingEntry, 3, () => tileContent.setActionText("action 2"));

    // Scrub backward past the failing entry
    await manager.goToHistoryEntry(0);

    // Entry 2 (action2) should have been undone successfully, then entry 1
    // (failingEntry) failed to undo. Rollback position is failedEntryIndex + 1 = 2,
    // so entries 0 and 1 are still "applied". tileContent should reflect
    // action1's value because action2's undo ran before the failure.
    expect(manager.numHistoryEventsApplied).toBe(2);
    expect(tileContent.actionText).toBe("action 1");
    expect(manager.historyPlaybackFailures.length).toBe(1);
    expect(manager.historyPlaybackFailures[0].historyIndex).toBe(1);
    expect(manager.historyPlaybackFailures[0].direction).toBe("undo");
  });

  it("rolls back good records from the failing entry when scrubbing forward", async () => {
    const {tileContent, manager} = setupDocument();
    // mixedEntry records in forward order: good-1 (actionText), bad, good-3 (flag).
    // Applying forward: good-1 succeeds → bad fails. Rollback should undo good-1.
    seedHistory(manager, [makeRealHistoryEntry(mixedEntry)], 0,
      () => tileContent.setActionText("initial"));

    await manager.goToHistoryEntry(1);

    expect(tileContent.actionText).toBe("initial");
    expect(tileContent.flag).toBeUndefined();
    expect(manager.numHistoryEventsApplied).toBe(0);
    expect(manager.historyPlaybackFailures.length).toBe(1);
  });

  it("rolls back good records from the failing entry when scrubbing backward", async () => {
    const {tileContent, manager} = setupDocument();
    // Seed at position 1 as if mixedEntry had been played forward. State:
    // actionText = "good first", flag = true.
    // Scrubbing backward processes records in reverse: good-3's undo (flag → undefined)
    // succeeds, then the bad record's undo fails. Rollback should re-apply the flag patch.
    seedHistory(manager, [makeRealHistoryEntry(mixedEntry)], 1, () => {
      tileContent.setActionText("good first");
      tileContent.setFlag(true);
    });

    await manager.goToHistoryEntry(0);

    expect(tileContent.flag).toBe(true);
    expect(tileContent.actionText).toBe("good first");
    expect(manager.numHistoryEventsApplied).toBe(1);
    expect(manager.historyPlaybackFailures.length).toBe(1);
  });

  it("rolls back good patches from the failing record when scrubbing forward", async () => {
    const {tileContent, manager} = setupDocument();
    // mixedPatchesEntry's record has patches in order: good (actionText),
    // bad, good (flag). Forward: good-1 succeeds → bad fails. Rollback
    // should undo good-1.
    seedHistory(manager, [makeRealHistoryEntry(mixedPatchesEntry)], 0,
      () => tileContent.setActionText("initial"));

    await manager.goToHistoryEntry(1);

    expect(tileContent.actionText).toBe("initial");
    expect(tileContent.flag).toBeUndefined();
    expect(manager.numHistoryEventsApplied).toBe(0);
    expect(manager.historyPlaybackFailures.length).toBe(1);
  });

  it("rolls back good patches from the failing record when scrubbing backward", async () => {
    const {tileContent, manager} = setupDocument();
    // Seed at position 1 as if mixedPatchesEntry had been played forward.
    // State: actionText = "good patch first", flag = true.
    // Scrubbing backward applies inversePatches in reverse: good-3 inverse
    // (flag → undefined) succeeds, then bad inverse fails. Rollback should
    // re-apply the flag patch.
    seedHistory(manager, [makeRealHistoryEntry(mixedPatchesEntry)], 1, () => {
      tileContent.setActionText("good patch first");
      tileContent.setFlag(true);
    });

    await manager.goToHistoryEntry(0);

    expect(tileContent.flag).toBe(true);
    expect(tileContent.actionText).toBe("good patch first");
    expect(manager.numHistoryEventsApplied).toBe(1);
    expect(manager.historyPlaybackFailures.length).toBe(1);
  });
});

it("records tile model changes in response to shared model changes", async () => {
  const {tileContent, manager, sharedModel} = setupDocument();
  sharedModel.setValue("shared value");
  await expectEntryToBeComplete(manager, 1);
  expect(tileContent.text).toBe("shared value-tile");
  expect(tileContent.updateCount).toBe(1);

  const changeDocument: Instance<typeof CDocument> = manager.document;
  expect(getSnapshot(changeDocument.history)).toEqual([sharedModelChange]);
});
