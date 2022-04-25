import { getEnv, Instance, types } from "mobx-state-tree";
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
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      throw new Error("not implemented");
    }
  }));

export interface ToolContentModelType extends Instance<typeof ToolContentModel> {}

export const ToolMetadataModel = types.model("ToolMetadataModel", {
    id: types.string
  });
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

export function findMetadata(type: string, id: string) {
  const MetadataType = getToolContentInfoById(type)?.metadataClass;
  if (!MetadataType) return;

  if (!_private.metadata[id]) {
    _private.metadata[id] = MetadataType.create({ id });
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
