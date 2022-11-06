import { getEnv, getSnapshot, Instance, types } from "mobx-state-tree";
import { SharedModelType } from "../shared/shared-model";
import { ISharedModelManager } from "../shared/shared-model-manager";
import { getTileContentModels, getTileContentInfo } from "./tile-content-info";
import { ITileMetadataModel } from "./tile-metadata";
import { tileModelHooks } from "./tile-model-hooks";

/**
 * A dynamic union of tile content models. Its typescript type is `TileContentModel`.
 *
 * This uses MST's `late()`. It appears that `late()` runs the first time the
 * union is actually used by MST. For example to deserialize a snapshot or to
 * create an model instance. For this to work properly, these uses need to
 * happen after all necessary tiles are registered.
 *
 * By default a late type like this will have a type of `any`. All types in this
 * late union extend TileContentModel, so it is overridden to be
 * TileContentModel. This doesn't affect the MST runtime types.
 */
export const TileContentUnion = types.late<typeof TileContentModel>(() => {
  const contentModels = getTileContentModels();
  return types.union({ dispatcher: tileContentFactory }, ...contentModels) as typeof TileContentModel;
});

export const kUnknownTileType = "Unknown";

export interface ITileEnvironment {
  sharedModelManager?: ISharedModelManager;
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
      return getEnv(self) as ITileEnvironment | undefined;
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
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      throw new Error("not implemented");
    }
  }))
  // Add an empty api so the api methods can be used on this generic type
  .actions(self => tileModelHooks({}));

export interface ITileContentModel extends Instance<typeof TileContentModel> {}

interface IPrivate {
  metadata: Record<string, ITileMetadataModel>;
}

export const _private: IPrivate = {
  metadata: {}
};

export function isRegisteredTileType(type: string) {
  return !!getTileContentInfo(type);
}

export function tileContentFactory(snapshot: any) {
  const tileType: string | undefined = snapshot?.type;
  return getTileContentInfo(tileType)?.modelClass || UnknownContentModel;
}

export function findMetadata(type: string, id: string) {
  const MetadataType = getTileContentInfo(type)?.metadataClass;
  if (!MetadataType) return;

  if (!_private.metadata[id]) {
    _private.metadata[id] = MetadataType.create({ id });
  }
  return _private.metadata[id];
}

// The UnknownContentModel has to be defined in this tile-types module because it both
// "extends" TileContentModel and UnknownContentModel is used by the tileContentFactory function
// above. Because of this it is a kind of circular dependency.
// If UnknownContentModel is moved to its own module this circular dependency causes an error.
// If they are in the same module then this isn't a problem.
//
// There is a still an "unknown-content" module, so that module can
// register the tile without adding a circular dependency on tile-content-info here.
export const UnknownContentModel = TileContentModel
  .named("UnknownContentModel")
  .props({
    type: types.optional(types.literal(kUnknownTileType), kUnknownTileType),
    original: types.maybe(types.string)
  })
  .preProcessSnapshot(snapshot => {
    const type = snapshot?.type;
    return type && (type !== kUnknownTileType)
            ? {
              type: kUnknownTileType,
              original: JSON.stringify(snapshot)
            }
            : snapshot;
  });

export interface IUnknownContentModel extends Instance<typeof UnknownContentModel> {}
