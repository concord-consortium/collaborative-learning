import { Instance, SnapshotOut, types } from "mobx-state-tree";
import { getToolContentModels, getToolContentInfoById } from "./tool-content-info";

// It isn't clear when 'late' is run. Hopefully it will be run after all of
// the content models have been registered. If we remove the content model imports above,
// then these registrations will not happen until something else imports the content model,
// if the code is split into different modules and the tool modules are loaded dynamically
// we'd need to see if late will be delayed until after this dynamic loading
export const ToolContentUnion = types.late(() => {
  const contentModels = getToolContentModels();
  return types.union({ dispatcher: toolFactory }, ...contentModels);
});

export const kUnknownToolID = "Unknown";

// Generic "super class" of all tool content models
export const ToolContentModel = types.model("ToolContentModel",
  {
    // This has to be optional because the typescript type created from the sub models
    // has an `&` of this model and the sub model.  If this was just:
    //   type: types.string
    // then typescript has errors because we create tool content models without passing a
    // type value.
    //
    // It could be changed to
    //   type: types.maybe(types.string)
    // But that implies the wrong thing.
    // What it should imply is that all tool content model instances need to have a type.
    //
    // Since this is optional, it needs a default value, and Unknown seems like the
    // best option for this.
    // I verified that a tool content model could not be constructed with:
    //   ImageContentModel.create({ type: "Unknown" }).
    // This kind of create causes a typescript error.
    // I think it is because the image content type is more specific with its use of
    // types.literal so that overrides this less specific use of types.string
    //
    // Perhaps there is some better way to define this so that there would be an error
    // if a sub type does not override it.
    type: types.optional(types.string, kUnknownToolID)
  });

export type ToolContentModelType = Instance<typeof ToolContentModel>;

export const ToolMetadataModel = types.model("ToolMetadataModel",
  {
    id: types.string
  });
export type ToolMetadataModelType = Instance<typeof ToolMetadataModel>;

export const ToolButtonModel = types.model("ToolButton", {
  name: types.string,
  title: types.string,
  iconId: types.string,
  isDefault: false,
  isTileTool: false
});
export type ToolButtonModelType = Instance<typeof ToolButtonModel>;
export type ToolButtonSnapshot = SnapshotOut<typeof ToolButtonModel>;

interface IPrivate {
  metadata: { [id: string]: ToolMetadataModelType };
}

export const _private: IPrivate = {
  metadata: {}
};

export function isToolType(type: string) {
  return !!(type && getToolContentInfoById(type));
}

export function toolFactory(snapshot: any) {
  const toolType: string | undefined = snapshot && snapshot.type;
  return toolType && getToolContentInfoById(toolType)?.modelClass || UnknownContentModel;
}

export function findMetadata(type: string, id: string) {
  const MetadataType = getToolContentInfoById(type).metadataClass;
  if (!MetadataType) return;

  if (!_private.metadata[id]) {
    _private.metadata[id] = MetadataType.create({ id });
  }
  return _private.metadata[id];
}

// The Unknown content model has to be defined here because it is "extends" ToolContentModel
// so it depends on ToolContentModel but the toolFactory function also depends on UnknownContentModel
// so this is a circular dependency. If they are in the same module then this isn't a problem
// There is a still a "uknown-content" module it can be registered later to avoid another
// circular dependency.
export const UnknownContentModel = ToolContentModel
  .named("UnknownTool")
  .props({
    type: types.optional(types.literal(kUnknownToolID), kUnknownToolID),
    original: types.maybe(types.string)
  })
  .preProcessSnapshot(snapshot => {
    const type = snapshot && snapshot.type;
    return type && (type !== kUnknownToolID)
            ? {
              type: kUnknownToolID,
              original: JSON.stringify(snapshot)
            }
            : snapshot;
  });

export type UnknownContentModelType = Instance<typeof UnknownContentModel>;
