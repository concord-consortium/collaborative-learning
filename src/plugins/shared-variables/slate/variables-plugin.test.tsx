import { IAnyType, types, castToSnapshot } from "mobx-state-tree";
import {screen} from "@testing-library/react";
import { specTextTile } from "../../../components/tiles/text/spec-text-tile";
import { ISharedModelManager } from "../../../models/shared/shared-model-manager";
import { TextContentModel, TextContentModelType } from "../../../models/tiles/text/text-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables";
import { kVariableTextPluginName, VariablesPlugin } from "./variables-plugin";
import { insertTextVariable } from "./text-tile-buttons";
import { TileModel } from "../../../models/tiles/tile-model";
import { SharedModelType } from "../../../models/shared/shared-model";

// The text tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../../../models/tiles/text/text-registration";

// Register the variables plugin so the text tile will load it
import "../shared-variables-registration";

const libDebug = require("../../../lib/debug");

const TestTileModelContainer = types.model("TestTileModelContainer", {
  child: TileModel,
  variables: types.maybe(SharedVariables)
});

const TestTextContentModelContainer = types.model("TestTileContentModelContainer", {
  child: TextContentModel,
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
    addTileSharedModel(tileContentModel) {
      return variables;
    },
    removeTileSharedModel(tileContentModel, sharedModel) {
      // ignore this for now
    },
    getTileSharedModels(tileContentModel) {
      return variables ? [variables] : [];
    },
    getTileSharedModelsByType(tileContentModel, modelType) {
      return variables ? [variables] : [];
    },
    getSharedModelDragDataForTiles(tileIds: string[]) {
      return [];
    },
    getSharedModelTiles(sharedModel) {
      return [];
    },
    getSharedModelTileIds(sharedModel) {
      // ignore linked tiles for now
      return [];
    },
    addSharedModel(sharedModel) {
      // ignore this for now
    },
  };
};

// Note: in the diagram tests this method also sets up an onSnapshot listener to automatically
// update the content when the variables change. In this case we are manually triggering
// the updates
const setupContainer = (content: TextContentModelType, variables?: SharedVariablesType) => {
  const sharedModelManager = makeSharedModelManager(variables);
  TestTextContentModelContainer.create(
    {child: castToSnapshot(content), variables: castToSnapshot(variables)},
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

      plugin.dispose();
      libDebug.DEBUG_SHARED_MODELS = false;
    });

    it("does not log if there is not shared model manager without DEBUG_SHARED_MODELS", async () => {
      const textContent = TextContentModel.create({});

      const plugin = new VariablesPlugin(textContent);
      await jestSpyConsole("log", mockConsole => {
        plugin.addTileSharedModelWhenReady();
        expect(mockConsole).not.toBeCalled();
      });

      plugin.dispose();
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

      plugin.dispose();
      libDebug.DEBUG_SHARED_MODELS = false;
    });

    it("does not log if there is no shared model with DEBUG_SHARED_MODELS", async () => {
      const textContent = TextContentModel.create({});

      // This adds the manager without a shared model
      setupContainer(textContent);

      const plugin = new VariablesPlugin(textContent);
      await jestSpyConsole("log", mockConsole => {
        plugin.addTileSharedModelWhenReady();
        expect(mockConsole).not.toBeCalled();
      });

      plugin.dispose();
    });

    it("adds the shared model to the tile", async () => {
      const textContent = TextContentModel.create({});
      const variables = SharedVariables.create();

      // setup the environment with a shared model
      const {sharedModelManager} = setupContainer(textContent, variables);

      // override getTileSharedModels so it always returns undefined
      sharedModelManager.getTileSharedModels = jest.fn();
      const addSharedModelSpy = jest.spyOn(sharedModelManager, "addTileSharedModel");

      const plugin = new VariablesPlugin(textContent);
      plugin.addTileSharedModelWhenReady();

      plugin.dispose();

      expect(addSharedModelSpy).toHaveBeenCalled();
    });

  });

  describe("used in TextToolComponent", () => {

    it("renders successfully and creates the VariablesPlugin", () => {
      const {plugins, textTile} = specTextTile({});
      expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
      expect(screen.getByTestId("ccrte-editor")).toBeInTheDocument();
      const plugin = plugins?.[kVariableTextPluginName];
      expect(plugin).toBeDefined();
      expect(plugin).toBeInstanceOf(VariablesPlugin);
      expect(textTile).toBeDefined();
    });

    // it("finds no chips with empty content and no configured shared model", () => {
    //   const {plugins} = specTextTile({});
    //   const plugin = plugins?.[kVariableTextPluginName] as VariablesPlugin;
    //   expect(plugin.chipVariables).toHaveLength(0);
    // });

    it("can insert a variable", () => {
      const content = TextContentModel.create({});
      const variables = SharedVariables.create();

      // setup the environment with a shared model
      const sharedModelManager = makeSharedModelManager(variables);
      const tileModel = TileModel.create({content});

      // Create an MST tree with both the TileModel and the shared variables
      // and the sharedModelManager in the MST tree environment
      TestTileModelContainer.create(
        {child: castToSnapshot(tileModel), variables: castToSnapshot(variables)},
        {sharedModelManager}
      );

      const {plugins} = specTextTile({tileModel});

      // const plugin = plugins?.[kVariableTextPluginName] as VariablesPlugin;
      const editor = content.editor;
      const variable = variables.createVariable();
      variable.setName("a");
      insertTextVariable(variable, editor);
      // expect(plugin.chipVariables).toHaveLength(1);
      // expect(plugin.chipVariables[0]).toBe(variable);
    });

  });
});
