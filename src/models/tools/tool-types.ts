import { getEnv, Instance, ISerializedActionCall, types } from "mobx-state-tree";
import { ISharedModelManager, SharedModelType } from "./shared-model";
import { getToolContentModels, getToolContentInfoById } from "./tool-content-info";

/**
 * A dynamic union of tool/tile content models. Its typescript type is
 * `ToolContentModel`.
 *
 * This uses MST's `late()`. It appears that `late()` runs the first time the
 * union is actually used by MST. For example to deserialize a snapshot or to
 * create an model instance. For this to work properly, these uses need to
 * happen after all necessary tiles are registered.
 *
 * By default a late type like this will have a type of `any`. All types in this
 * late union extend ToolContentModel, so it is overridden to be
 * ToolContentModel. This doesn't affect the MST runtime types.
 */
export const ToolContentUnion = types.late<typeof ToolContentModel>(() => {
  const contentModels = getToolContentModels();
  return types.union({ dispatcher: toolFactory }, ...contentModels) as typeof ToolContentModel;
});

export const kUnknownToolID = "Unknown";

export interface ITileEnvironment {
  sharedModelManager?: ISharedModelManager;
}

export interface IToolContentModelHooks {
  /**
   * This is called after the wrapper around the content model is created. This wrapper is
   * a ToolTileModel. This should only be called once.
   *
   * @param metadata an instance of this model's metadata it might be shared by
   * multiple instances of the model if the document of this model is open in
   * more than one place.
   */
  doPostCreate?(metadata: ToolMetadataModelType): void,

  /**
   * This is called for any action that is called on the wrapper (ToolTile) or one of
   * its children. It can be used for logging or internal monitoring of action calls.
   */
  onTileAction?(call: ISerializedActionCall): void,

  /**
   * This is called before the tile is removed from the row of the document.
   * Immediately after the tile is removed from the row it is also removed from
   * the tileMap which is the actual container of the tile. 
   */
  willRemoveFromDocument?(): void
}

// This is a way to work with MST action syntax
// The input argument has to match the api and the result
// is a literal object type which is compatible with the ModelActions
// type that is required.
// A downside is that when working with the specific model type
// TS doesn't know which methods of the API it actually implements

/**
 * A TypeScript helper method for adding hooks to a content model. It should be
 * used like:
 * ```
 * .actions(self => toolContentModelHooks({
 *   // add your hook functions here
 * }))
 * ```
 *
 * Unfortunately all hooks you define become optional. Because these hooks
 * should normally only be called by the framework, most likely this issue will
 * only come up in tests.
 *
 * @param hooks the hook functions
 * @returns the hook functions in a literal object format that is compatible
 * with the ModelActions type of MST
 */
export function toolContentModelHooks(hooks: IToolContentModelHooks) {
  return {...hooks};
}

// Generic "super class" of all tool content models
export const ToolContentModel = types.model("ToolContentModel", {
    // The type field has to be optional because the typescript type created from the sub models
    // is an intersection ('&') of this ToolContentModel and the sub model.  If this was just:
    //   type: types.string
    // then typescript has errors because the intersection logic means the type field is
    // required when creating a content model. And in many cases these tool content models
    // are created without passing a type.
    //
    // It could be changed to
    //   type: types.maybe(types.string)
    // Because of the intersection it would still mean the sub models would do the right thing,
    // but if someone looks at this definition of ToolContentModel, it implies the wrong thing.
    // It might also cause problems when code is working with a generic of ToolContentModel
    // that code couldn't assume that `model.type` is defined.
    //
    // Since this is optional, it needs a default value, and Unknown seems like the
    // best option for this.
    // I verified that a specific tool content models could not be constructed with:
    //   ImageContentModel.create({ type: "Unknown" }).
    // That line causes a typescript error.
    // I think it is because the image content type is more specific with its use of
    // types.literal so that overrides this less specific use of types.string
    //
    // Perhaps there is some better way to define this so that there would be an error
    // if a sub type does not override it.
    type: types.optional(types.string, kUnknownToolID)
  })
  .views(self => ({
    get tileEnv() {
      return getEnv(self) as ITileEnvironment | undefined;
    }
  }))
  .actions(self => ({
    /**
     * This will be called automatically by the tree monitor. 
     * Currently the call tree looks like:
     * addTreeMonitor.recordAction
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
  .actions(self => toolContentModelHooks({}));

export interface ToolContentModelType extends Instance<typeof ToolContentModel> {}

export const ToolMetadataModel = types.model("ToolMetadataModel", {
    // id of associated tile
    id: types.string,
    // title of associated tile
    title: types.maybe(types.string)
  })
  .actions(self => ({
    setTitle(title: string) {
      self.title = title;
    }
  }));
export interface ToolMetadataModelType extends Instance<typeof ToolMetadataModel> {}

interface IPrivate {
  metadata: Record<string, ToolMetadataModelType>;
}

export const _private: IPrivate = {
  metadata: {}
};

export function isToolType(type: string) {
  return !!getToolContentInfoById(type);
}

export function toolFactory(snapshot: any) {
  const toolType: string | undefined = snapshot?.type;
  return getToolContentInfoById(toolType)?.modelClass || UnknownContentModel;
}

export function findMetadata(type: string, id: string, title?: string) {
  const MetadataType = getToolContentInfoById(type)?.metadataClass;
  if (!MetadataType) return;

  if (!_private.metadata[id]) {
    _private.metadata[id] = MetadataType.create({ id, title });
  }
  return _private.metadata[id];
}

// The UnknownContentModel has to be defined in this tool-types module because it both
// "extends" ToolContentModel and UnknownContentModel is used by the toolFactory function
// above. Because of this it is a kind of circular dependency.
// If UnknownContentModel is moved to its own module this circular dependency causes an error.
// If they are in the same module then this isn't a problem.
//
// There is a still an "unknown-content" module, so that module can
// register the tool without adding a circular dependency on tool-content-info here.
export const UnknownContentModel = ToolContentModel
  .named("UnknownTool")
  .props({
    type: types.optional(types.literal(kUnknownToolID), kUnknownToolID),
    original: types.maybe(types.string)
  })
  .preProcessSnapshot(snapshot => {
    const type = snapshot?.type;
    return type && (type !== kUnknownToolID)
            ? {
              type: kUnknownToolID,
              original: JSON.stringify(snapshot)
            }
            : snapshot;
  });

export interface UnknownContentModelType extends Instance<typeof UnknownContentModel> {}
