import { getSnapshot, getType, Instance, types } from "mobx-state-tree";
import { IToolTileProps } from "src/components/tools/tool-tile";
import { SharedModel, SharedModelType } from "../tools/shared-model";
import { ToolContentModel } from "../tools/tool-types";
import { registerSharedModelInfo, registerToolContentInfo } from "../tools/tool-content-info";
import { DocumentContentModel } from "../document/document-content";
import { createDocumentModel, DocumentModelType } from "../document/document";
import { ProblemDocument } from "../document/document-types";
import { when } from "mobx";
import { CDocument } from "./document-store";

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
    throw new Error("Function not implemented.");
  },
  Component: TestTileComponent,
  toolTileClass: "test-tile"
});

function setupDocument() {
  const doc = DocumentContentModel.create({
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
  });
  
  // This is needed to setup the tree monitor and shared model manager
  const docModel = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    content: doc as any
  });

  const sharedModel = doc.sharedModelMap.get("sm1")?.sharedModel as TestSharedModelType;
  const tileContent = doc.tileMap.get("t1")?.content as TestTileType;

  return {docModel, sharedModel, tileContent};
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
  const {docModel, tileContent} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true);

  await expectEntryToBeComplete(docModel, 1);
  const changeDocument = docModel.container.documentStore.document as Instance<typeof CDocument>;

  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialUpdateEntry 
  ]);
});  

const undoEntry = {
  action: "undo", 
  created: expect.any(Number), 
  id: expect.any(String),
  records: [
    { action: "/applyContainerPatches",
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
  tree: "container", 
  undoable: false
};

it("can undo a tile change", async () => {
  const {docModel, tileContent} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true);

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(docModel, 1);

  const container = docModel.container;
  const undoStore = container.undoStore;
  undoStore.undo();
  await expectEntryToBeComplete(docModel, 2);

  expect(tileContent.flag).toBeUndefined();

  const changeDocument = container.documentStore.document as Instance<typeof CDocument>;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialUpdateEntry,
    undoEntry
  ]);
});  

it("can redo a tile change", async () => {
  const {docModel, tileContent} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  tileContent.setFlag(true);

  // Make sure this entry is recorded before undoing it
  await expectEntryToBeComplete(docModel, 1);

  const container = docModel.container;
  const undoStore = container.undoStore;
  undoStore.undo();
  await expectEntryToBeComplete(docModel, 2);

  expect(tileContent.flag).toBeUndefined();

  undoStore.redo();
  await expectEntryToBeComplete(docModel, 3);

  expect(tileContent.flag).toBe(true);

  const changeDocument = container.documentStore.document as Instance<typeof CDocument>;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialUpdateEntry,
    undoEntry,
    {
      action: "redo", 
      created: expect.any(Number), 
      id: expect.any(String),
      records: [
        { action: "/applyContainerPatches",
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
      tree: "container", 
      undoable: false
    }
  ]);
});  

const initialSharedModelUpdateEntry = { 
  action: "/content/sharedModelMap/sm1/sharedModel/setValue", 
  created: expect.any(Number), 
  id: expect.any(String),
  records: [
    { action: "/updateTreeAfterSharedModelChangesInternal", 
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
  const {docModel, sharedModel, tileContent} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something");

  // This might not really be needed but it is a good way to wait for all of the async
  // calls to propagate before making assertions
  await expectUpdateToBeCalledTimes(tileContent, 1);

  const changeDocument = docModel.container.documentStore.document;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialSharedModelUpdateEntry 
  ]);
});  

const undoSharedModelEntry = {
  action: "undo", 
  created: expect.any(Number), 
  id: expect.any(String),
  records: [
    { action: "/applyContainerPatches",
      inversePatches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: "something-tile"}
      ], 
      patches: [
        { op: "replace", path: "/content/tileMap/t1/content/text", value: undefined}
      ], 
      tree: "test"
    }, 
    { action: "/applyContainerPatches", 
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
  tree: "container", 
  undoable: false
};

it("can undo a shared model change", async () => {
  const {docModel, sharedModel, tileContent} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something");

  // This might not really be needed but it is a good way to wait for all of the async
  // calls to propagate before making assertions
  await expectUpdateToBeCalledTimes(tileContent, 1);
  expect(sharedModel.value).toBe("something");

  const container = docModel.container;
  const undoStore = container.undoStore;

  undoStore.undo();

  // TODO: document why the update is called 2 more times here
  await expectUpdateToBeCalledTimes(tileContent, 3);

  expect(sharedModel.value).toBeUndefined();

  const changeDocument = docModel.container.documentStore.document;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialSharedModelUpdateEntry,
    undoSharedModelEntry
  ]);
});

it("can redo a shared model change", async () => {
  const {docModel, sharedModel, tileContent} = setupDocument();
  // This should record a history entry with this change and any changes to tiles
  // triggered by this change
  sharedModel.setValue("something");

  // This might not really be needed but it is a good way to wait for all of the async
  // calls to propagate before making assertions
  await expectUpdateToBeCalledTimes(tileContent, 1);
  expect(sharedModel.value).toBe("something");
  expect(tileContent.text).toBe("something-tile");

  const container = docModel.container;
  const undoStore = container.undoStore;

  undoStore.undo();

  // TODO: document why the update is called 2 more times here
  await expectUpdateToBeCalledTimes(tileContent, 3);
  expect(sharedModel.value).toBeUndefined();
  expect(tileContent.text).toBeUndefined();

  undoStore.redo();

  // TODO: document why the update is called 3 more times here
  await expectUpdateToBeCalledTimes(tileContent, 6);
  expect(sharedModel.value).toBe("something");
  expect(tileContent.text).toBe("something-tile");

  const changeDocument = docModel.container.documentStore.document;
  expect(getSnapshot(changeDocument.history)).toEqual([ 
    initialSharedModelUpdateEntry,
    undoSharedModelEntry,
    {
      action: "redo", 
      created: expect.any(Number), 
      id: expect.any(String),
      records: [
        { action: "/applyContainerPatches",
          inversePatches: [
            { op: "replace", path: "/content/tileMap/t1/content/text", value: undefined}
          ], 
          patches: [
            { op: "replace", path: "/content/tileMap/t1/content/text", value: "something-tile"}
          ], 
          tree: "test"
        }, 
        { action: "/applyContainerPatches", 
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
      tree: "container", 
      undoable: false
    }
  ]);
});

async function expectUpdateToBeCalledTimes(testTile: TestTileType, times: number) {
  const updateCalledTimes = when(() => testTile.updateCount === times, {timeout: 100});
  return expect(updateCalledTimes).resolves.toBeUndefined();
}

async function expectEntryToBeComplete(docModel: DocumentModelType, length: number) {
  const changeDocument = docModel.container.documentStore.document as Instance<typeof CDocument>;
  const changeEntryComplete = when(
    () => changeDocument.history.length === length && changeDocument.history.at(length-1)?.state === "complete", 
    {timeout: 100});
  await expect(changeEntryComplete).resolves.toBeUndefined();
}
