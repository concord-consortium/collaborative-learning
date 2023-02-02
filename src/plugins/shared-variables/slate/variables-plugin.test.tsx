import { IAnyStateTreeNode, IAnyType, types, castToSnapshot } from "mobx-state-tree";
import { contextType } from "react-modal";
import { SharedModelType } from "../../../models/shared/shared-model";
import { ISharedModelManager } from "../../../models/shared/shared-model-manager";
import { TextContentModel, TextContentModelType } from "../../../models/tiles/text/text-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables";
import { VariablesPlugin } from "./variables-plugin";

const libDebug = require("../../../lib/debug");

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

describe("VariablesPlugin", () => {
  describe("addTileSharedModelWhenReady", () => {
    it("logs if there is not shared model manager with DEBUG_SHARED_MODELS", async () => {
      libDebug.DEBUG_SHARED_MODELS = true;
      const textContent = TextContentModel.create({});

      const plugin = new VariablesPlugin(textContent);
      await jestSpyConsole("log", mockConsole => {
        plugin.addTileSharedModelWhenReady();
        expect(mockConsole).toBeCalled();
      });

      // FIXME: need to dispose the autorun
      libDebug.DEBUG_SHARED_MODELS = false;
    });

    it("does not log if there is not shared model manager without DEBUG_SHARED_MODELS", async () => {
      const textContent = TextContentModel.create({});

      const plugin = new VariablesPlugin(textContent);
      await jestSpyConsole("log", mockConsole => {
        plugin.addTileSharedModelWhenReady();
        expect(mockConsole).not.toBeCalled();
      });

      // FIXME: need to dispose the autorun
    });

    it("logs if there is no shared model with DEBUG_SHARED_MODELS", async () => {
      libDebug.DEBUG_SHARED_MODELS = true;
      const textContent = TextContentModel.create({});

      // This adds the manager without a shared model
      setupContainer(textContent);

      const plugin = new VariablesPlugin(textContent);
      await jestSpyConsole("log", mockConsole => {
        plugin.addTileSharedModelWhenReady();
        expect(mockConsole).toBeCalled();
      });

      // FIXME: need to dispose the autorun
      libDebug.DEBUG_SHARED_MODELS = false;
    });

    it("does not logs if there is no shared model with DEBUG_SHARED_MODELS", async () => {
      const textContent = TextContentModel.create({});

      // This adds the manager without a shared model
      setupContainer(textContent);

      const plugin = new VariablesPlugin(textContent);
      await jestSpyConsole("log", mockConsole => {
        plugin.addTileSharedModelWhenReady();
        expect(mockConsole).not.toBeCalled();
      });

      // FIXME: need to dispose the autorun
    });

    it("adds the shared model to the tile", async () => {
      const textContent = TextContentModel.create({});
      const variables = SharedVariables.create();

      // setup the environment without a shared model
      const {sharedModelManager} = setupContainer(textContent, variables);

      // override getTileSharedModels so it always returns undefined
      sharedModelManager.getTileSharedModels = jest.fn();
      const addSharedModelSpy = jest.spyOn(sharedModelManager, "addTileSharedModel");

      const plugin = new VariablesPlugin(textContent);
      plugin.addTileSharedModelWhenReady();

      // FIXME: need to dispose the autorun

      expect(addSharedModelSpy).toHaveBeenCalled();
    });

  });

});
