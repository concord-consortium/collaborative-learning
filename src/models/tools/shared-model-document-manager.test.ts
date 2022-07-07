import { Instance, types } from "mobx-state-tree";

import { IToolTileProps } from "../../components/tools/tool-tile";
import { SharedModel, SharedModelType } from "./shared-model";
import { createSharedModelDocumentManager } from "./shared-model-document-manager";
import { registerSharedModelInfo, registerToolContentInfo } from "./tool-content-info";
import { ToolContentModel } from "./tool-types";
import { DocumentContentModel } from "../document/document-content";

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

registerSharedModelInfo({
  type: "TestSharedModel",
  modelClass: TestSharedModel
});

const TestSharedModel2 = SharedModel
  .named("TestSharedModel2")
  .props({type: "TestSharedModel2"});

registerSharedModelInfo({
  type: "TestSharedModel2",
  modelClass: TestSharedModel2
});

// Snapshot processor type
const _TestSharedModel3 = SharedModel
  .named("TestSharedModel3")
  .props({type: "TestSharedModel3"});
const TestSharedModel3 = types.snapshotProcessor(_TestSharedModel3, {
  preProcessor(snapshot: any) {
    // Remove any extra properties
    return {
      id: snapshot.id,
      type: snapshot.type,
    };
  }
});

registerSharedModelInfo({
  type: "TestSharedModel3",
  // modelClass prop is restrictive, but the snapshotProcessor type should work fine
  modelClass: TestSharedModel3 as typeof _TestSharedModel3
});


const TestTile = ToolContentModel
  .named("TestTile")
  .props({type: "TestTile"})
  .actions(self => ({
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      // do nothing
    }
  }));
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

describe("SharedModelDocumentManager", () => {
  it("handles setDocument with an empty doc", () => {
    const doc = DocumentContentModel.create();
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);    
  });

  it("is ready when there is a document", () => {
    const doc = DocumentContentModel.create();
    const manager = createSharedModelDocumentManager();
    expect(manager.isReady).toBe(false);
    manager.setDocument(doc);
    expect(manager.isReady).toBe(true);
  });

  // FIXME this feature is handled by the tree monitor now
  // So we'd need to create a Document instead of DocumentContent so the tree monitor
  // would get automatically setup. 
  xit("calls tileContent#updateAfterSharedModelChanges when the shared model changes", () => {
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
            type: "TestTile",
          },
        }
      }
    });

    const toolTile = doc.tileMap.get("t1");
    assertIsDefined(toolTile);
    const tileContent = toolTile.content;
    assertIsDefined(tileContent);
    const spyUpdate = jest.spyOn(tileContent, 'updateAfterSharedModelChanges');
    expect(spyUpdate).not.toHaveBeenCalled();
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);
    expect(spyUpdate).not.toHaveBeenCalled();

    const sharedModelEntry = doc.sharedModelMap.get("sm1");
    expect(sharedModelEntry).toBeDefined();
    const sharedModel = sharedModelEntry?.sharedModel as Instance<typeof TestSharedModel>;
    expect(sharedModel).toBeDefined();

    sharedModel.setValue("something");

    // Not sure if this will get called in time
    expect(spyUpdate).toHaveBeenCalled();
  });

  // FIXME: this is also handled by the tree monitor see above
  xit("starts monitoring shared models added after the document", () => {
    const doc = DocumentContentModel.create({
      tileMap: {
        "t1": {
          id: "t1",
          content: {
            type: "TestTile",
          },
        }
      }
    });

    const toolTile = doc.tileMap.get("t1");
    assertIsDefined(toolTile);
    const tileContent = toolTile.content;
    assertIsDefined(tileContent);
    const spyUpdate = jest.spyOn(tileContent, 'updateAfterSharedModelChanges');
    expect(spyUpdate).not.toHaveBeenCalled();
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);
    expect(spyUpdate).not.toHaveBeenCalled();

    const sharedModel = TestSharedModel.create({});
    manager.addTileSharedModel(tileContent, sharedModel);

    // The update function should be called right after it is added
    expect(spyUpdate).toHaveBeenCalled();
    spyUpdate.mockClear();
    expect(spyUpdate).not.toHaveBeenCalled();

    // it should be monitoring this now
    sharedModel.setValue("something");
    expect(spyUpdate).toHaveBeenCalled();
  });

  // FIXME: this is also handled by the tree monitor see above
  xit("updates tiles added after the document", () => {
    const doc = DocumentContentModel.create({
      sharedModelMap: {
        "sm1": {
          sharedModel: {
            id: "sm1",
            type: "TestSharedModel"
          }
        }
      },
    });

    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);

    const sharedModel = doc.sharedModelMap.get("sm1")?.sharedModel;
    assertIsDefined(sharedModel);

    const tileContent = TestTile.create();
    const spyUpdate = jest.spyOn(tileContent, 'updateAfterSharedModelChanges');
    doc.addTileContentInNewRow(tileContent);
    expect(spyUpdate).not.toHaveBeenCalled();

    manager.addTileSharedModel(tileContent, sharedModel);

    // The update function should be called right after it is added
    expect(spyUpdate).toHaveBeenCalled();
    spyUpdate.mockClear();
    expect(spyUpdate).not.toHaveBeenCalled();

    // it should be monitoring this now
    (sharedModel as Instance<typeof TestSharedModel>).setValue("something");
    expect(spyUpdate).toHaveBeenCalled();
  });

  // FIXME: this is also handled by the tree monitor see above
  xit("handles setting the document twice", () => {
    const docSnapshot = {
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
            type: "TestTile",
          }
        }
      }
    };
    const doc = DocumentContentModel.create(docSnapshot);

    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);

    const tileContent = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent);
    const spyUpdate = jest.spyOn(tileContent, 'updateAfterSharedModelChanges');
    const sharedModel = doc.sharedModelMap.get("sm1")?.sharedModel;
    (sharedModel as Instance<typeof TestSharedModel>).setValue("something");
    expect(spyUpdate).toHaveBeenCalled();

    spyUpdate.mockClear();

    const doc2 = DocumentContentModel.create(docSnapshot);
    manager.setDocument(doc2);
    const tileContent2 = doc2.tileMap.get("t1")?.content;
    assertIsDefined(tileContent2);
    const spyUpdate2 = jest.spyOn(tileContent2, 'updateAfterSharedModelChanges');
    const sharedModel2 = doc2.sharedModelMap.get("sm1")?.sharedModel;
    (sharedModel2 as Instance<typeof TestSharedModel>).setValue("something");
    expect(spyUpdate2).toHaveBeenCalled();

  });

  it("finds a shared model by type", () => {
    const doc = DocumentContentModel.create({
      sharedModelMap: {
        "sm1": {
          sharedModel: {
            id: "sm1",
            type: "TestSharedModel"
          }
        }
      },
    });
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);
    const sharedModel = manager.findFirstSharedModelByType(TestSharedModel);
    expect(sharedModel?.id).toBe("sm1");

    const sharedModel2 = manager.findFirstSharedModelByType(TestSharedModel2);
    expect(sharedModel2).toBeUndefined();
  });

  it("finds a snapshotProcessor shared model by the original type", () => {
    const doc = DocumentContentModel.create({
      sharedModelMap: {
        "sm1": {
          sharedModel: {
            id: "sm1",
            type: "TestSharedModel3",
            foo: "hello"
          }
        }
      },
    });
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);
    const sharedModel = manager.findFirstSharedModelByType(_TestSharedModel3);
    expect(sharedModel?.id).toBe("sm1");

    const sharedModel2 = manager.findFirstSharedModelByType(TestSharedModel3 as typeof _TestSharedModel3);
    expect(sharedModel2?.id).toBeUndefined();

    const sharedModel3 = manager.findFirstSharedModelByType(TestSharedModel);
    expect(sharedModel3).toBeUndefined();
  });

  it("provides warnings when finding a shared model by type", () => {
    const doc = DocumentContentModel.create({
      sharedModelMap: {
        "sm1": {
          sharedModel: {
            id: "sm1",
            type: "TestSharedModel"
          }
        }
      },
    });
    const manager = createSharedModelDocumentManager();

    jestSpyConsole("warn", spy => {
      const result1 = manager.findFirstSharedModelByType(TestSharedModel);
      expect(spy).toHaveBeenCalled();
      expect(result1).toBeUndefined();
      spy.mockClear();

      manager.setDocument(doc);

      const result2 = manager.findFirstSharedModelByType(TestSharedModel);
      expect(spy).not.toHaveBeenCalled();
      expect(result2?.id).toBe("sm1");
    });
  });

  it("gets shared models associated with the tile", () => {
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
            type: "TestTile",
          },
        },
        "t2": {
          id: "t2",
          content: {
            type: "TestTile",
          },
        }
      }
    });

    const toolTile = doc.tileMap.get("t1");
    assertIsDefined(toolTile);
    const tileContent = toolTile.content;
    assertIsDefined(tileContent);
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);
    const tileSharedModels = manager.getTileSharedModels(tileContent);
    expect(tileSharedModels).toBeDefined();
    expect(tileSharedModels).toHaveLength(1);
    expect(tileSharedModels[0]?.id).toBe("sm1");

    const toolTile2 = doc.tileMap.get("t2");
    assertIsDefined(toolTile2);
    const tileContent2 = toolTile2.content;
    assertIsDefined(tileContent2);
    const tileSharedModels2 = manager.getTileSharedModels(tileContent2);
    expect(tileSharedModels2).toBeDefined();
    expect(tileSharedModels2).toHaveLength(0);
  });

  it("provides warnings when getting shared models for invalid cases", () => {
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
            type: "TestTile",
          },
        },
      }
    });

    const tileContent = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent);
    const manager = createSharedModelDocumentManager();

    jestSpyConsole("warn", spy => {
      const result1 = manager.getTileSharedModels(tileContent);
      expect(spy).toHaveBeenCalled();
      expect(result1).toHaveLength(0);
      spy.mockClear();

      manager.setDocument(doc);

      const notAttachedTileContent = TestTile.create({});
      const result2 = manager.getTileSharedModels(notAttachedTileContent);
      expect(spy).toHaveBeenCalled();
      expect(result2).toHaveLength(0);
      spy.mockClear();

      // Just make sure a valid call works without warning
      const result3 = manager.getTileSharedModels(tileContent);
      expect(spy).not.toHaveBeenCalled();
      expect(result3).toHaveLength(1);      
    });
  });

  it("adds a shared model to the tile and document", () => {
    const doc = DocumentContentModel.create({
      tileMap: {
        "t1": {
          id: "t1",
          content: {
            type: "TestTile",
          },
        }
      }
    });

    const toolTile = doc.tileMap.get("t1");
    assertIsDefined(toolTile);
    const tileContent = toolTile.content;
    assertIsDefined(tileContent);
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);

    const spyUpdate = jest.spyOn(tileContent, 'updateAfterSharedModelChanges');

    // might need to specify the type...
    const sharedModel = TestSharedModel.create({});
    manager.addTileSharedModel(tileContent, sharedModel);
    const sharedModelEntry = doc.sharedModelMap.get(sharedModel.id);
    expect(sharedModelEntry).toBeDefined();

    expect(sharedModelEntry?.sharedModel).toBeDefined();
    expect(sharedModelEntry?.tiles).toHaveLength(1);
    expect(sharedModelEntry?.tiles[0]?.id).toBe("t1");

    expect(spyUpdate).toHaveBeenCalled();
  });

  // FIXME: this is also handled by the tree monitor see above
  xit("a shared model can be added to multiple tiles", () => {
    const doc = DocumentContentModel.create({
      tileMap: {
        "t1": {
          id: "t1",
          content: {
            type: "TestTile",
          },
        },
        "t2": {
          id: "t2",
          content: {
            type: "TestTile",
          },
        }
      }
    });

    const tileContent1 = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent1);
    const spyUpdate1 = jest.spyOn(tileContent1, 'updateAfterSharedModelChanges');

    const tileContent2 = doc.tileMap.get("t2")?.content;
    assertIsDefined(tileContent2);
    const spyUpdate2 = jest.spyOn(tileContent2, 'updateAfterSharedModelChanges');

    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);

    const sharedModel = TestSharedModel.create({});

    // Add to the first tile (and document)
    manager.addTileSharedModel(tileContent1, sharedModel);
    const sharedModelEntry = doc.sharedModelMap.get(sharedModel.id);
    expect(sharedModelEntry?.tiles[0]?.id).toBe("t1");

    // The update function should be called right after it is added
    expect(spyUpdate1).toHaveBeenCalled();
    expect(spyUpdate2).not.toHaveBeenCalled();

    spyUpdate1.mockClear();
    expect(spyUpdate1).not.toHaveBeenCalled();

    // just tile 1 should be monitoring this now
    sharedModel.setValue("something");
    expect(spyUpdate1).toHaveBeenCalled();
    expect(spyUpdate2).not.toHaveBeenCalled();

    spyUpdate1.mockClear();  

    // Add to the second tile
    manager.addTileSharedModel(tileContent2, sharedModel);
    expect(doc.sharedModelMap.get(sharedModel.id)).toBe(sharedModelEntry);
    expect(sharedModelEntry?.tiles[0]?.id).toBe("t1");
    expect(sharedModelEntry?.tiles[1]?.id).toBe("t2");

    // The update function of the newly added tile should be called right after
    // it is added
    expect(spyUpdate2).toHaveBeenCalled();
    // The existing tile's update function shouldn't be called
    expect(spyUpdate1).not.toHaveBeenCalled();
    
    spyUpdate2.mockClear();

    // now both tile's update functions should be called when the shared
    // model changes
    sharedModel.setValue("something2");
    expect(spyUpdate1).toHaveBeenCalled();
    expect(spyUpdate2).toHaveBeenCalled();
  });

  it("a shared model added to a tile twice is only stored once", () => {
    const doc = DocumentContentModel.create({
      tileMap: {
        "t1": {
          id: "t1",
          content: {
            type: "TestTile",
          },
        }
      }
    });

    const tileContent = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent);
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);

    const spyUpdate = jest.spyOn(tileContent, 'updateAfterSharedModelChanges');

    const sharedModel = TestSharedModel.create({});

    // First add
    manager.addTileSharedModel(tileContent, sharedModel);
    const sharedModelEntry = doc.sharedModelMap.get(sharedModel.id);
    expect(sharedModelEntry?.sharedModel).toBe(sharedModel);
    expect(sharedModelEntry?.tiles).toHaveLength(1);
    expect(sharedModelEntry?.tiles[0]?.id).toBe("t1");
    expect(spyUpdate).toHaveBeenCalled();

    spyUpdate.mockClear();

    // Second add
    manager.addTileSharedModel(tileContent, sharedModel);
    expect(doc.sharedModelMap.get(sharedModel.id)).toBe(sharedModelEntry);
    expect(sharedModelEntry?.sharedModel).toBe(sharedModel);
    expect(sharedModelEntry?.tiles).toHaveLength(1);
    expect(sharedModelEntry?.tiles[0]?.id).toBe("t1");

    expect(spyUpdate).not.toHaveBeenCalled();
  });

  // FIXME: this is also handled by the tree monitor see above
  xit("a second shared model can be added to a tile", () => {
    const doc = DocumentContentModel.create({
      tileMap: {
        "t1": {
          id: "t1",
          content: {
            type: "TestTile",
          },
        }
      }
    });

    const tileContent = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent);
    const spyUpdate = jest.spyOn(tileContent, 'updateAfterSharedModelChanges');
    expect(spyUpdate).not.toHaveBeenCalled();
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);
    expect(spyUpdate).not.toHaveBeenCalled();

    const sharedModel1 = TestSharedModel.create({});
    manager.addTileSharedModel(tileContent, sharedModel1);

    // The update function should be called right after it is added
    expect(spyUpdate).toHaveBeenCalled();
    spyUpdate.mockClear();
    expect(spyUpdate).not.toHaveBeenCalled();

    // it should be monitoring this now
    sharedModel1.setValue("something");
    expect(spyUpdate).toHaveBeenCalled();

    const sharedModel2 = TestSharedModel.create({});
    manager.addTileSharedModel(tileContent, sharedModel2);

    // The update function should be called right after second model is added
    expect(spyUpdate).toHaveBeenCalled();
    spyUpdate.mockClear();
    expect(spyUpdate).not.toHaveBeenCalled();

    // it should still be monitoring the first model
    sharedModel1.setValue("something2");
    expect(spyUpdate).toHaveBeenCalled();
    spyUpdate.mockClear();
    expect(spyUpdate).not.toHaveBeenCalled();

    // it should also be monitoring the second model
    sharedModel2.setValue("something");
    expect(spyUpdate).toHaveBeenCalled();
  });

  it("provides warnings when adding a shared model in some cases", () => {
    const doc = DocumentContentModel.create({
      tileMap: {
        "t1": {
          id: "t1",
          content: {
            type: "TestTile",
          },
        }
      }
    });

    const tileContent = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent);

    const manager = createSharedModelDocumentManager();
    const sharedModel = TestSharedModel.create({});

    jestSpyConsole("warn", spy => {
      manager.addTileSharedModel(tileContent, sharedModel);
      expect(spy).toHaveBeenCalled();
      const sharedModelEntry1 = doc.sharedModelMap.get(sharedModel.id);
      expect(sharedModelEntry1).toBeUndefined();
      spy.mockClear();

      manager.setDocument(doc);

      const notAttachedTileContent = TestTile.create({});
      manager.addTileSharedModel(notAttachedTileContent, sharedModel);
      expect(spy).toHaveBeenCalled();
      const sharedModelEntry2 = doc.sharedModelMap.get(sharedModel.id);
      expect(sharedModelEntry2).toBeUndefined();
      spy.mockClear();

      // It works when called correctly
      manager.addTileSharedModel(tileContent, sharedModel);
      expect(spy).not.toHaveBeenCalled();
      const sharedModelEntry3 = doc.sharedModelMap.get(sharedModel.id);
      expect(sharedModelEntry3).toBeDefined();
    });
  });

  it("removes shared models associated with a tile", () => {
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
            type: "TestTile",
          },
        },
      }
    });

    const tileContent = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent);
    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);

    const tileSharedModels = manager.getTileSharedModels(tileContent);
    expect(tileSharedModels).toBeDefined();
    expect(tileSharedModels).toHaveLength(1);
    const sharedModel = tileSharedModels[0];
    expect(sharedModel?.id).toBe("sm1");

    manager.removeTileSharedModel(tileContent, sharedModel);
    const tileSharedModelsAfter = manager.getTileSharedModels(tileContent);
    expect(tileSharedModelsAfter).toBeDefined();
    expect(tileSharedModelsAfter).toHaveLength(0);
  });

  it("provides warnings when removing shared models associated with a tile", () => {
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
            type: "TestTile",
          },
        },
      }
    });

    const tileContent = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent);
    const manager = createSharedModelDocumentManager();
    const sharedModel = doc.sharedModelMap.get("sm1")?.sharedModel;
    assertIsDefined(sharedModel);

    jestSpyConsole("warn", spy => {
      manager.removeTileSharedModel(tileContent, sharedModel);
      expect(spy).toHaveBeenCalled();
      spy.mockClear();
  
      manager.setDocument(doc);
  
      const notAttachedTileContent = TestTile.create({});
      manager.removeTileSharedModel(notAttachedTileContent, sharedModel);
      expect(spy).toHaveBeenCalled();
      spy.mockClear();
  
      const notAttachedSharedModel = TestSharedModel.create({});
      manager.removeTileSharedModel(tileContent, notAttachedSharedModel);
      expect(spy).toHaveBeenCalled();
      spy.mockClear();  
    });
  });

  it("handles a tile being deleted that references a shared model", () => {
    const doc = DocumentContentModel.create({
      sharedModelMap: {
        "sm1": {
          sharedModel: {
            id: "sm1",
            type: "TestSharedModel"
          },
          tiles: [ "t1", "t2" ]
        }
      },
      tileMap: {
        "t1": {
          id: "t1",
          content: {
            type: "TestTile",
          },
        },
        "t2": {
          id: "t2",
          content: {
            type: "TestTile",
          },
        },
      }
    });

    // Make sure this is working normally
    const tileContent1 = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent1);
    const spyUpdate1 = jest.spyOn(tileContent1, 'updateAfterSharedModelChanges');

    const tileContent2 = doc.tileMap.get("t2")?.content;
    assertIsDefined(tileContent2);
    const spyUpdate2 = jest.spyOn(tileContent2, 'updateAfterSharedModelChanges');

    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);

    expect(spyUpdate1).not.toHaveBeenCalled();
    expect(spyUpdate2).not.toHaveBeenCalled();

    const sharedModelEntry = doc.sharedModelMap.get("sm1");
    expect(sharedModelEntry).toBeDefined();
    const sharedModel = sharedModelEntry?.sharedModel as Instance<typeof TestSharedModel>;
    expect(sharedModel).toBeDefined();
    sharedModel.setValue("something");

    expect(spyUpdate1).toHaveBeenCalled();
    expect(spyUpdate2).toHaveBeenCalled();

    // Delete tile t2
    doc.deleteTile("t2");

    // Make sure tile t1 is still working
    spyUpdate1.mockClear();
    sharedModel.setValue("something else");
    expect(spyUpdate1).toHaveBeenCalled();
  });

  it("handles a loading a shared model entry with a broken reference", () => {
    const doc = DocumentContentModel.create({
      sharedModelMap: {
        "sm1": {
          sharedModel: {
            id: "sm1",
            type: "TestSharedModel"
          },
          tiles: [ "t1", "t2" ]
        }
      },
      tileMap: {
        "t1": {
          id: "t1",
          content: {
            type: "TestTile",
          },
        },
      }
    });

    // Make sure this is working normally
    const tileContent1 = doc.tileMap.get("t1")?.content;
    assertIsDefined(tileContent1);
    const spyUpdate1 = jest.spyOn(tileContent1, 'updateAfterSharedModelChanges');

    const manager = createSharedModelDocumentManager();
    manager.setDocument(doc);

    expect(spyUpdate1).not.toHaveBeenCalled();

    const sharedModelEntry = doc.sharedModelMap.get("sm1");
    expect(sharedModelEntry).toBeDefined();
    const sharedModel = sharedModelEntry?.sharedModel as Instance<typeof TestSharedModel>;
    expect(sharedModel).toBeDefined();
    sharedModel.setValue("something");

    expect(spyUpdate1).toHaveBeenCalled();
  });
});

