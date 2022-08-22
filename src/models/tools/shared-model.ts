import { IAnyStateTreeNode, Instance, types } from "mobx-state-tree";
import { uniqueId } from "../../utilities/js-utils";
// TODO: This is a circular import, tool-content-info also imports SharedModel from here
// This can be fixed by splitting shared-models into 2 files. One of those files will have
// SharedModel, SharedModelType in it. Those objects don't need tool-content-info, and it is
// those objects that are used by tool-content-info
// This same refactoring can be applied to tool-types to eliminate a circular import there.
import { getSharedModelClasses, getSharedModelInfoByType } from "./tool-content-info";

export const kUnknownSharedModel = "unknownSharedModel";

// Generic "super class" of all shared models
export const SharedModel = types.model("SharedModel", {
  // The type field has to be optional because the typescript type created from the sub models
  // is an intersection ('&') of this SharedModel and the sub model.  If this was just:
  //   type: types.string
  // then typescript has errors because the intersection logic means the type field is
  // required when creating a shared model. And we don't want to require the
  // type when creating the shared model. This might be solvable by using the
  // mst snapshot preprocessor to add the type.
  //
  // It could be changed to
  //   type: types.maybe(types.string)
  // Because of the intersection it would still mean the sub models would do the right thing,
  // but if someone looks at this definition of SharedModel, it implies the wrong thing.
  // It might also cause problems when code is working with a generic of SharedModel
  // that code couldn't assume that `model.type` is defined.
  //
  // Since this is optional, it needs a default value, and Unknown seems like the
  // best option for this.
  //
  // Perhaps there is some better way to define this so that there would be an error
  // if a sub type does not override it.
  type: types.optional(types.string, kUnknownSharedModel),

  // if not provided, will be generated
  id: types.optional(types.identifier, () => uniqueId()),
})
.volatile(self => ({
  indexOfType: -1
}))
.actions(self => ({
  setIndexOfType(index: number) {
    self.indexOfType = index;
  },
  willUpdateContent() {
    // "derived" shared model objects can override
  },
  didUpdateContent() {
    // "derived" shared model objects can override
  }
}));

export interface SharedModelType extends Instance<typeof SharedModel> {}

export function sharedModelFactory(snapshot: any) {
  const sharedModelType: string | undefined = snapshot?.type;
  return sharedModelType && getSharedModelInfoByType(sharedModelType)?.modelClass || UnknownSharedModel;
}

export const SharedModelUnion = types.late<typeof SharedModel>(() => {
  const sharedModels = getSharedModelClasses();
  return types.union({ dispatcher: sharedModelFactory }, ...sharedModels) as typeof SharedModel;
});

// The UnknownSharedModel has to be defined in this shared-model module because it both
// "extends" SharedModel and UnknownSharedModel is used by the sharedModelFactory function
// above. Because of this it is a kind of circular dependency.
// If UnknownSharedModel is moved to its own module this circular dependency causes an error.
// If they are in the same module then this isn't a problem.
// The UnknownSharedModel is not currently registered like other shared models. It is created
// by the sharedModelFactory when no matching model type is found.
const _UnknownSharedModel = SharedModel
  .named("UnknownSharedModel")
  .props({
    type: types.optional(types.literal(kUnknownSharedModel), kUnknownSharedModel),
    original: types.maybe(types.string)
  });

export const UnknownSharedModel = types.snapshotProcessor(_UnknownSharedModel, {
  // Maybe we can type the snapshot better?
  preProcessor(snapshot: any) {
    const type = snapshot?.type;
    return type && (type !== kUnknownSharedModel)
            ? {
              type: kUnknownSharedModel,
              original: JSON.stringify(snapshot)
            }
            : snapshot;
  },

  postProcessor(snapshot: any) {
    return JSON.parse(snapshot.original);
  }
});

/**
 * An instance of this interface should be provided to tiles so they can interact
 * with shared models.
 */
export interface ISharedModelManager {
  /**
   * The manager might be available, but is not ready to be used yet.
   */
  get isReady(): boolean;

  /**
   * Find the shared model at the container level. If the tile wants to use this
   * shared model it should call `addTileSharedModel`. This is necessary so the
   * container knows to call the tile's updateAfterSharedModelChanges action
   * whenever the shared model changes.
   *
   * @param sharedModelType the MST model "class" of the shared model
   */
  findFirstSharedModelByType<IT extends typeof SharedModelUnion>(
    sharedModelType: IT, providerId?: string): IT["Type"] | undefined;

  /**
   * Return an array of all models of the specified type.
   *
   * @param sharedModelType the MST model "class" of the shared model
   */
  getSharedModelsByType<IT extends typeof SharedModelUnion>(type: string): IT["Type"][];

  /**
   * Add a shared model to the container if it doesn't exist and add a link to
   * the tile from the shared model.
   *
   * If the shared model was already part of this container it won't be added to
   * the container twice. If the shared model already had a link to this tile it
   * won't be added twice.
   *
   * Tiles need to call this method when they use a shared model. This is how
   * the container knows to call the tile's updateAfterSharedModelChanges when
   * the shared model changes.
   *
   * Multiple shared models can be added to a single tile. All of these shared
   * models will be returned by getTileSharedModels. If a tile is using multiple
   * shared models of the same type, it might want to additionally keep its own
   * references to these shared models. Without these extra references it would
   * be hard to tell which shared model is which.
   *
   * @param tileContentModel the tile content model that should be notified when
   * this shared model changes
   *
   * @param sharedModel the new or existing shared model that is going to be
   * used by this tile.
   */
  addTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType, isProvider?: boolean): void;

  /**
   * Remove the link from the shared model to the tile.
   *
   * @param tileContentModel the tile content model that doesn't want to be
   * notified anymore of shared model changes.
   *
   * @param sharedModel an existing shared model
   */
  removeTileSharedModel(tileContentModel: IAnyStateTreeNode, sharedModel: SharedModelType): void;

  /**
   * Get all of the shared models that link to this tile
   *
   * @param tileContentModel
   */
  getTileSharedModels(tileContentModel: IAnyStateTreeNode): SharedModelType[];
}
