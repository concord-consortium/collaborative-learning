import { IFormulaManager } from "@concord-consortium/codap-formulas-react17/dist/models/formula/formula-manager-types";
import { getEnv, getSnapshot, hasEnv, Instance, types } from "mobx-state-tree";
import { SharedModelType } from "../shared/shared-model";
import { ISharedModelManager } from "../shared/shared-model-manager";
import { tileContentAPIActions, tileContentAPIViews } from "./tile-model-hooks";
import { kUnknownTileType } from "./unknown-types";

export interface ITileEnvironment {
  sharedModelManager?: ISharedModelManager;
  formulaManager?: IFormulaManager;
}

// Generic "super class" of all tile content models
export const TileContentModel = types.model("TileContentModel", {
    // The type field has to be optional because the typescript type created from the sub models
    // is an intersection ('&') of this TileContentModel and the sub model.  If this was just:
    //   type: types.string
    // then typescript has errors because the intersection logic means the type field is
    // required when creating a content model. And in many cases these tile content models
    // are created without passing a type.
    //
    // It could be changed to
    //   type: types.maybe(types.string)
    // Because of the intersection it would still mean the sub models would do the right thing,
    // but if someone looks at this definition of TileContentModel, it implies the wrong thing.
    // It might also cause problems when code is working with a generic of TileContentModel
    // that code couldn't assume that `model.type` is defined.
    //
    // Since this is optional, it needs a default value, and Unknown seems like the
    // best option for this.
    // I verified that a specific tile content model could not be constructed with:
    //   ImageContentModel.create({ type: "Unknown" }).
    // That line causes a typescript error.
    // I think it is because the image content type is more specific with its use of
    // types.literal so that overrides this less specific use of types.string
    //
    // Perhaps there is some better way to define this so that there would be an error
    // if a sub type does not override it.
    type: types.optional(types.string, kUnknownTileType)
  })
  .views(self => ({
    get tileEnv() {
      return hasEnv(self) ? getEnv(self) as ITileEnvironment : undefined;
    },
    // Override in specific tile content model when external data (like from SharedModels) is needed when copying
    get tileSnapshotForCopy() {
      return getSnapshot(self);
    }
  }))
  .actions(self => ({
    /**
     * This will be called automatically by the tree monitor.
     * Currently the call tree looks like:
     * TreeMonitor.recordAction
     * └ Tree.handleSharedModelChanges
     *   └ Tree.updateTreeAfterSharedModelChangesInternal
     *     └ Tree.updateTreeAfterSharedModelChanges
     *       └ tile.content.updateAfterSharedModelChanges
     *
     * It is also called after the manager has finished applying patches
     * during an undo or replying history.
     *
     * @param sharedModel
     */
    updateAfterSharedModelChanges(sharedModel: SharedModelType | undefined) {
      // console.warn("updateAfterSharedModelChanges not implemented for:", self.type);
    }
  }))
  // Add empty apis so they are available on the generic type
  .actions(self => tileContentAPIActions({}))
  .views(self => tileContentAPIViews({}));

export interface ITileContentModel extends Instance<typeof TileContentModel> {}
