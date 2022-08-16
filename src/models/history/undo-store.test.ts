import { getSnapshot, getType, Instance, types } from "mobx-state-tree";
import { IToolTileProps } from "src/components/tools/tool-tile";
import { SharedModel, SharedModelType } from "../tools/shared-model";
import { ToolContentModel } from "../tools/tool-types";
import { registerSharedModelInfo, registerToolContentInfo } from "../tools/tool-content-info";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { createDocumentModel } from "../document/document";
import { ProblemDocument } from "../document/document-types";
import { when } from "mobx";
import { CDocument, TreeManager } from "./tree-manager";
import { HistoryEntrySnapshot } from "./history";
import { nanoid } from "nanoid";
import { cloneDeep } from "lodash";
import { withoutUndo } from "./tree-monitor";

const TestSharedModel = SharedModel
  .named("TestSharedModel")
  .props({
    type: "TestSharedModel",
    value: types.maybe(types.string)
  })
  .actions(self => ({
    setValue(value: string){
      self.value = value;
    }
  }));
interface TestSharedModelType extends Instance<typeof TestSharedModel> {}

registerSharedModelInfo({
  type: "TestSharedModel",
  modelClass: TestSharedModel
});

const TestTile = ToolContentModel
  .named("TestTile")
  .props({
    type: "TestTile", 
    text: types.maybe(types.string),
    flag: types.maybe(types.boolean)
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
      self.text = sharedModelValue ? sharedModelValue + "-tile" : undefined;
    },
    setFlag(_flag: boolean) {
      self.flag = _flag;
    },
    setFlagWithoutUndo(_flag: boolean){
      withoutUndo();      
      self.flag = _flag;
    }
  }));
interface TestTileType extends Instance<typeof TestTile> {}

const TestTileComponent: React.FC<IToolTileProps> = () => {
  throw new Error("Component not implemented.");
};

registerToolContentInfo({
  id: "TestTile",
  modelClass: TestTile,
  defaultContent(options) {
    return TestTile.create();
  },
  Component: TestTileComponent,
  toolTileClass: "test-tile"
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

  const sharedModel = docContent.sharedModelMap.get("sm1")?.sharedModel as TestSharedModelType;
  const tileContent = docContent.tileMap.get("t1")?.content as TestTileType;
  const manager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  const undoStore = manager.undoStore;

  return {docContent, sharedModel, tileContent, manager, undoStore};
}

const initialUpdateEntry = {
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

it("records a tile change as one history event with one TreeRecordEntry", async () => {
  const {tileContent, manager} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true);

  await expectEntryToBeComplete(manager, 1);
  const changeDocument = manager.document as Instance<typeof CDocument>;

  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialUpdateEntry 
  ]);
});  

const undoEntry = {
  action: "undo", 
  created: expect.any(Number), 
  id: expect.any(String),
  records: [
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: true}
      ], 
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/flag", value: undefined}
      ], 
      tree: "test"
    }, 
  ], 
  state: "complete", 
  tree: "manager", 
  undoable: false
};

it("can undo a tile change", async () => {
  const {tileContent, manager, undoStore} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true);

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(manager, 1);

  undoStore.undo();
  await expectEntryToBeComplete(manager, 2);

  expect(tileContent.flag).toBeUndefined();

  const changeDocument = manager.document as Instance<typeof CDocument>;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialUpdateEntry,
    undoEntry
  ]);
});  

const redoEntry = {
  action: "redo", 
  created: expect.any(Number), 
  id: expect.any(String),
  records: [
    { action: "/applyPatchesFromManager",
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
  tree: "manager", 
  undoable: false
};

it("can redo a tile change", async () => {
  const {tileContent, manager, undoStore} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true);

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(manager, 1);

  undoStore.undo();
  await expectEntryToBeComplete(manager, 2);

  expect(tileContent.flag).toBeUndefined();

  undoStore.redo();
  await expectEntryToBeComplete(manager, 3);

  expect(tileContent.flag).toBe(true);

  const changeDocument = manager.document as Instance<typeof CDocument>;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialUpdateEntry,
    undoEntry,
    redoEntry
  ]);
});  

it("can skip adding an action to the undo list", async () => {
  const {tileContent, manager, undoStore} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlagWithoutUndo(true);

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(manager, 1);

  expect(undoStore.canUndo).toBe(false);

  expect(tileContent.flag).toBe(true);

  const changeDocument = manager.document as Instance<typeof CDocument>;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    // override the action name of the initialUpdateEntry
    {
      ...initialUpdateEntry,
      action: "/content/tileMap/t1/content/setFlagWithoutUndo",
      undoable: false,
      records: [{
        ...initialUpdateEntry.records[0],
        action: "/content/tileMap/t1/content/setFlagWithoutUndo",
      }]
    }
  ]);
});

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

it("can replay the history entries", async () => {
    // TODO: this isn't the best test because we are starting out with some initial
    // document state. We should create a history entry that setups up this initial
    // document state so we can test creating a document's content complete from
    // scratch.
    const {tileContent, manager} = setupDocument();
        
    // Add the history entries used in the tests above so we can replay them all at 
    // the same time.
    const history = [
      makeRealHistoryEntry(initialUpdateEntry),
      makeRealHistoryEntry(undoEntry),
      makeRealHistoryEntry(redoEntry)
    ];
    manager.setChangeDocument(CDocument.create({history}));
    await manager.replayHistoryToTrees();

    expect(tileContent.flag).toBe(true);

    // The history should not change after it is replayed
    const changeDocument = manager.document as Instance<typeof CDocument>;
    expect(getSnapshot(changeDocument.history)).toEqual(history);
  
});

const initialSharedModelUpdateEntry = { 
  action: "/content/sharedModelMap/sm1/sharedModel/setValue", 
  created: expect.any(Number), 
  id: expect.any(String),
  records: [
    { action: "/handleSharedModelChanges", 
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: undefined}
      ], 
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "something-tile"}
      ], 
      tree: "test"
    }, 
    { action: "/content/sharedModelMap/sm1/sharedModel/setValue", 
      inversePatches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: undefined}
      ], 
      patches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: "something"}
      ], 
      tree: "test"
    }
  ], 
  state: "complete", 
  tree: "test", 
  undoable: true
};

it("records a shared model change as one history event with two TreeRecordEntries", async () => {
  const {sharedModel, manager} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something");

  await expectEntryToBeComplete(manager, 1);

  const changeDocument = manager.document;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialSharedModelUpdateEntry 
  ]);
});  

const undoSharedModelEntry = {
  action: "undo", 
  created: expect.any(Number), 
  id: expect.any(String),
  records: [
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "something-tile"}
      ], 
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: undefined}
      ], 
      tree: "test"
    }, 
    { action: "/applyPatchesFromManager", 
      inversePatches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: "something"}
      ], 
      patches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: undefined}
      ], 
      tree: "test"
    }
  ], 
  state: "complete", 
  tree: "manager", 
  undoable: false
};

it("can undo a shared model change", async () => {
  const {sharedModel, tileContent, manager, undoStore} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something");

  // This might not really be needed but it is a good way to wait for all of the async
  // calls to propagate before making assertions
  await expectUpdateToBeCalledTimes(tileContent, 1);
  expect(sharedModel.value).toBe("something");

  undoStore.undo();

  await expectEntryToBeComplete(manager, 2);
  // TODO: document why update is called 1 more times here
  await expectUpdateToBeCalledTimes(tileContent, 3);

  expect(sharedModel.value).toBeUndefined();

  const changeDocument = manager.document;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialSharedModelUpdateEntry,
    undoSharedModelEntry
  ]);
});

const redoSharedModelEntry = {
  action: "redo", 
  created: expect.any(Number), 
  id: expect.any(String),
  records: [
    { action: "/applyPatchesFromManager",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: undefined}
      ], 
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "something-tile"}
      ], 
      tree: "test"
    }, 
    { action: "/applyPatchesFromManager", 
      inversePatches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: undefined}
      ], 
      patches: [
        { op: "replace", path: "/content/sharedModelMap/sm1/sharedModel/value", value: "something"}
      ], 
      tree: "test"
    }
  ], 
  state: "complete", 
  tree: "manager", 
  undoable: false
};

it("can redo a shared model change", async () => {
  const {sharedModel, tileContent, manager, undoStore} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something");

  // This might not really be needed but it is a good way to wait for all of the async
  // calls to propagate before making assertions
  await expectUpdateToBeCalledTimes(tileContent, 1);
  expect(sharedModel.value).toBe("something");
  expect(tileContent.text).toBe("something-tile");

  undoStore.undo();

  // TODO: document why the update is called 1 more times here
  await expectUpdateToBeCalledTimes(tileContent, 3);
  expect(sharedModel.value).toBeUndefined();
  expect(tileContent.text).toBeUndefined();

  undoStore.redo();

  // TODO: document why the update is called 1 more times here
  await expectUpdateToBeCalledTimes(tileContent, 5);
  expect(sharedModel.value).toBe("something");
  expect(tileContent.text).toBe("something-tile");

  const changeDocument = manager.document;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialSharedModelUpdateEntry,
    undoSharedModelEntry,
    redoSharedModelEntry
  ]);
});

it("can replay history entries that include shared model changes", async () => {
  // TODO: this isn't the best test because we are starting out with some initial
  // document state. We should create a history entry that setups up this initial
  // document state so we can test creating a document's content complete from
  // scratch.
  const {tileContent, sharedModel, manager} = setupDocument();
  
  // Add the history entries used in the tests above so we can replay them all at 
  // the same time.
  const history = [
    makeRealHistoryEntry(initialSharedModelUpdateEntry),
    makeRealHistoryEntry(undoSharedModelEntry),
    makeRealHistoryEntry(redoSharedModelEntry)
  ];

  manager.setChangeDocument(CDocument.create({history}));
  await manager.replayHistoryToTrees();

  expect(sharedModel.value).toBe("something");
  expect(tileContent.text).toBe("something-tile");

  // The history should not change after it is replayed
  const changeDocument = manager.document;
  expect(getSnapshot(changeDocument.history)).toEqual(history);
});

// This is recording 3 events for something that should probably be 1
// However we don't have a good solution for that yet.
it("can track the addition of a new shared model", async () => {
  // Start with just a tile and no shared model
  const {tileContent, manager} = setupDocument({
    tileMap: {
      "t1": {
        id: "t1",
        content: {
          type: "TestTile"
        },
      }
    }
  });
  
  const sharedModelManager = tileContent.tileEnv?.sharedModelManager;
  const newSharedModel = TestSharedModel.create({value: "new model"});
  const sharedModelId = newSharedModel.id;
  sharedModelManager?.addTileSharedModel(tileContent, newSharedModel);

  await expectEntryToBeComplete(manager, 3);

  const changeDocument = manager.document;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    {
      action: "/content/addSharedModel",
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        {
          action: "/content/addSharedModel",
          inversePatches: [
            { op: "remove", path: `/content/sharedModelMap/${sharedModelId}` } 
          ],
          patches: [
            {
              op: "add", path: `/content/sharedModelMap/${sharedModelId}`,
              value: {
                sharedModel: {
                  id: sharedModelId,
                  type: "TestSharedModel",
                  value: "new model"
                },
                tiles: []
              }
            }
          ],
          tree: "test"
        }
      ],
      state: "complete",
      tree: "test",
      undoable: true
    },
    {
      action: `/content/sharedModelMap/${sharedModelId}/addTile`,
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        {
          action: `/content/sharedModelMap/${sharedModelId}/addTile`,
          inversePatches: [
            { op: "remove", path: `/content/sharedModelMap/${sharedModelId}/tiles/0`}
          ],
          patches: [
            {
              op: "add", path: `/content/sharedModelMap/${sharedModelId}/tiles/0`,
              value: "t1"
            }
          ],
          tree: "test"
        }
      ],
      state: "complete",
      tree: "test",
      undoable: true
    },
    {
      action: "/content/tileMap/t1/content/updateAfterSharedModelChanges",
      created: expect.any(Number),
      id: expect.any(String),
      records: [
        {
          action: "/content/tileMap/t1/content/updateAfterSharedModelChanges",
          inversePatches: [
            { 
              op: "replace", path: "/content/tileMap/t1/content/text",
              value: undefined
            }
          ],
          patches: [
            {
              op: "replace", path: "/content/tileMap/t1/content/text",
              value: "new model-tile"
            }
          ],
          tree: "test"
        }
      ],
      state: "complete",
      tree: "test",
      undoable: true
    }
  ]);
});

async function expectUpdateToBeCalledTimes(testTile: TestTileType, times: number) {
  const updateCalledTimes = when(() => testTile.updateCount === times, {timeout: 100});
  return expect(updateCalledTimes).resolves.toBeUndefined();
}

// TODO: it would nicer to use a custom Jest matcher here so we can
// provide a better error message when it fails
async function expectEntryToBeComplete(manager: Instance<typeof TreeManager>, length: number) {
  const changeDocument = manager.document as Instance<typeof CDocument>;
  let timedOut = false;
  try {
    await when(
      () => changeDocument.history.length >= length && changeDocument.history.at(length-1)?.state === "complete", 
      {timeout: 100});  
  } catch (e) {
    timedOut = true;
  }
  expect({
    historyLength: changeDocument.history.length,
    lastEntryState: changeDocument.history.at(-1)?.state,
    activeExchanges: changeDocument.history.at(-1)?.activeExchanges.toJSON(),
    timedOut
  }).toEqual({
    historyLength: length,
    lastEntryState: "complete",
    activeExchanges: [],
    timedOut: false
  });
}
