import { castToSnapshot, IAnyStateTreeNode, IAnyType, isAlive, onSnapshot, types } from "mobx-state-tree";
import { when } from "mobx";
import { VariableType } from "@concord-consortium/diagram-view";
import { createDiagramContent, defaultDiagramContent,
  DiagramContentModel, DiagramContentModelType } from "./diagram-content";
import { SharedModelType } from "../../models/shared/shared-model";
import { ISharedModelManager, SharedModelUnion } from "../../models/shared/shared-model-manager";
import { SharedVariables, SharedVariablesType } from "../shared-variables/shared-variables";

const TestContainer = types.model("TestContainer", {
  content: DiagramContentModel,
  variables: types.maybe(SharedVariables)
});

const makeSharedModelManager = (variables?: SharedVariablesType): ISharedModelManager => {
  return {
    isReady: true,
    getSharedModelProviders(model: SharedModelType){
      return [];
    },
    getSharedModelLabel(model: SharedModelType) {
      return model.id;
    },
    findFirstSharedModelByType<IT extends IAnyType>(sharedModelType: IT): IT["Type"] | undefined {
      return variables;
    },
    getSharedModelsByType<IT extends IAnyType>(type: string): IT["Type"][] {
      return [variables];
    },
    addTileSharedModel(tileContentModel: IAnyStateTreeNode): SharedModelType | undefined {
      return variables;
    },
    removeTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType): void {
      // ignore this for now
    },
    getTileSharedModels(tileContentModel: IAnyStateTreeNode): SharedModelType[] {
      return variables ? [variables] : [];
    },
    getTileSharedModelsByType(tileContentModel: IAnyStateTreeNode, modelType: typeof SharedModelUnion):
      SharedModelType[] {
      return variables ? [variables] : [];
    },
    getSharedModelDragDataForTiles(tileIds: string[]) {
      return [];
    },
    getSharedModelTiles(sharedModel?: SharedModelType) {
      return [];
    },
    getSharedModelTileIds(sharedModel?: SharedModelType) {
      // ignore linked tiles for now
      return [];
    },
    addSharedModel(sharedModel: SharedModelType): void {
      // ignore this for now
    },
  };
};

const setupContainer = (content: DiagramContentModelType, variables?: SharedVariablesType) => {
  const sharedModelManager = makeSharedModelManager(variables);
  TestContainer.create(
    {content: castToSnapshot(content), variables: castToSnapshot(variables)},
    {sharedModelManager}
  );

  // Need to monitor the variables just like sharedModelDocumentManager does
  if (variables) {
    onSnapshot(variables, () => {
      content.updateAfterSharedModelChanges(variables);
    });
  }

  // So far it hasn't been necessary to wait for the MobX reaction to run inside of
  // DocumentContent#afterAttach. It seems to run immediately in the line above, so
  // we can write expectations on this content without waiting.
  return {content, sharedModelManager};
};

describe("DiagramContent", () => {
  it("has default content", () => {
    const content = defaultDiagramContent();
    expect(content.root).toBeDefined();
  });

  it("can export content", () => {
    const content = createDiagramContent();
    const expected = {type: "Diagram", version: "0.0.3", root: {nodes: {}}};
    expect(JSON.parse(content.exportJson())).toEqual(expected);
  });

  it("is always user resizable", () => {
    const content = createDiagramContent();
    expect(content.isUserResizable).toBe(true);
  });

  const setupContent = () => {
    const content = createDiagramContent();
    const variables = SharedVariables.create();
    return setupContainer(content, variables).content;
  };

  it("sets up variables api after being attached", () => {
    const content = setupContent();
    expect(content.root.variablesAPI).toBeDefined();
  });

  // This is more of an integration test because it is testing the innards of
  // DQRoot, but it exercises code provided by the diagram-content in the process
  it("supports creating Nodes", () => {
    const content = setupContent();

    expect(content.root.nodes.size).toBe(0);
    expect(content.sharedModel?.variables.length).toBe(0);

    content.root.createNode({x: 1, y: 1});
    expect(content.root.nodes.size).toBe(1);
    const newNode = Array.from(content.root.nodes.values())[0];
    assertIsDefined(newNode);

    expect(content.sharedModel?.variables.length).toBe(1);
    expect(newNode.x).toBe(1);
    expect(newNode.variable).toBeDefined();
  });

  it("createVariable in the variables api adds a variable", () => {
    const content = setupContent();

    const variablesAPI = content.root.variablesAPI;
    assertIsDefined(variablesAPI);

    const variable = variablesAPI.createVariable();
    expect(variable).toBeDefined();
  });

  const createBasicModel = () => {
    const content = createDiagramContent({
      root: {
        nodes: {
          "node1": {
            x: 1,
            y: 1,
            variable: "variable1"
          }
        }
      },
    });
    const variables = SharedVariables.create({
      variables: [
        {
          id: "variable1",
          name: "test variable"
        }
      ]
    });
    return setupContainer(content, variables).content;
  };

  it("can handle basic de-serialization", () => {
    const content = createBasicModel();

    expect(content.root.nodes.size).toBe(1);
    const firstNode = Array.from(content.root.nodes.values())[0];
    assertIsDefined(firstNode);

    expect(content.sharedModel?.variables.length).toBe(1);
    expect(firstNode.variable).toBeDefined();
  });

  it("removeVariable in the variables api removes a variable", (done) => {
    const content = createBasicModel();
    const variablesAPI = content.root.variablesAPI;
    assertIsDefined(variablesAPI);

    const firstNode = Array.from(content.root.nodes.values())[0];
    assertIsDefined(firstNode);

    // TODO VariableType We shouldn't have to cast this
    variablesAPI.removeVariable(firstNode.variable as VariableType);

    // Need to wait for the variable and node to be removed, we use mobx's `when` for this.
    // It should monitor the nodes size and run the predicate when it goes back to 0
    // when it is done we call Jest's `done`. By default Jest will wait 5 seconds for the
    // done to be called.
    when(() => content.root.nodes.size === 0, () => {
      expect(content.sharedModel?.variables.length).toBe(0);
      expect(isAlive(firstNode)).toBeFalsy();
      done();
    });
  });

  it("creates the variables shared model, if there isn't one", () => {
    const content = createDiagramContent();
    const sharedModelManager = makeSharedModelManager();
    const addTileSharedModelSpy = jest.spyOn(sharedModelManager, "addTileSharedModel");
    TestContainer.create(
      {content: castToSnapshot(content)},
      {sharedModelManager}
    );

    expect(addTileSharedModelSpy).toHaveBeenCalled();
  });

  it("handles off chance that updateAfterSharedModelChanges is called before things are ready", () => {
    const content = createDiagramContent();
    jestSpyConsole("warn", spy => {
      expect(() => content.updateAfterSharedModelChanges()).not.toThrow();
      expect(spy).toHaveBeenCalledWith("updateAfterSharedModelChanges was called with no shared model present");
    });
  });
});
