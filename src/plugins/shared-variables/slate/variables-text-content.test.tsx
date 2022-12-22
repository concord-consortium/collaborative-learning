import { IAnyStateTreeNode, IAnyType, types, castToSnapshot } from "mobx-state-tree";
import { createEditor, withHistory, withReact } from "@concord-consortium/slate-editor";
import { SharedModelType } from "../../../models/shared/shared-model";
import { ISharedModelManager } from "../../../models/shared/shared-model-manager";
import { TextContentModel, TextContentModelType } from "../../../models/tiles/text/text-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables";
import { getOrFindSharedModel} from "./variables-text-content";
import { VariablesPlugin } from "./variables-plugin";

const TestContainer = types.model("TestContainer", {
  content: TextContentModel,
  variables: types.maybe(SharedVariables)
});

const makeSharedModelManager = (variables?: SharedVariablesType): ISharedModelManager => {
  return {
    isReady: true,
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
    getSharedModelTiles(sharedModel?: SharedModelType) {
      return [];
    },
    getSharedModelTileIds(sharedModel?: SharedModelType) {
      // ignore linked tiles for now
      return [];
    }
  };
};

// Note: in the diagram tests this method also sets up an onSnapshot listener to automatically
// update the content when the variables change. In this case we are manually triggering
// the updates
const setupContainer = (content: TextContentModelType, variables?: SharedVariablesType) => {
  const sharedModelManager = makeSharedModelManager(variables);
  TestContainer.create(
    {content: castToSnapshot(content), variables: castToSnapshot(variables)},
    {sharedModelManager}
  );

  // So far it hasn't been necessary to wait for the MobX reaction to run inside of
  // DocumentContent#afterAttach. It seems to run immediately in the line above, so
  // we can write expectations on this content without waiting.
  return {content, sharedModelManager};
};

describe("VariablesTextContent", () => {
  test("getOrFindSharedModel warns if things aren't setup", async () => {
    const textContent = TextContentModel.create({});

    await jestSpyConsole("warn", mockConsole => {
      getOrFindSharedModel(textContent);
      expect(mockConsole).toBeCalled();
    });

    // setup the environment without a shared model
    setupContainer(textContent);

    await jestSpyConsole("warn", mockConsole => {
      getOrFindSharedModel(textContent);
      expect(mockConsole).toBeCalled();
    });
  });

  test("getOrFindSharedModel adds the shared model to the tile", async () => {
    const textContent = TextContentModel.create({});
    const variables = SharedVariables.create();

    // setup the environment without a shared model
    const {sharedModelManager} = setupContainer(textContent, variables);

    // override getTileSharedModels so it always returns undefined
    sharedModelManager.getTileSharedModels = jest.fn();
    const addSharedModelSpy = jest.spyOn(sharedModelManager, "addTileSharedModel");

    getOrFindSharedModel(textContent);

    expect(addSharedModelSpy).toHaveBeenCalled();
  });
});
