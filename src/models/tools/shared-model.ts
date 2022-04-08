import { Instance, types } from "mobx-state-tree";
import { uniqueId } from "../../utilities/js-utils";
// FIXME: This is a circular reference tool-content-info also imports SharedModel from here
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
});

export interface SharedModelType extends Instance<typeof SharedModel> {}

export function sharedModelFactory(snapshot: any) {
  const sharedModelType: string | undefined = snapshot?.type;
  return sharedModelType && getSharedModelInfoByType(sharedModelType)?.modelClass || UnknownSharedModel;
}

export const SharedModelUnion = types.late(() => {
  const sharedModels = getSharedModelClasses();
  console.log("late shared models", sharedModels);
  return types.union({ dispatcher: sharedModelFactory }, ...sharedModels);
});

// The UnknownContentModel has to be defined in this tool-types module because it both
// "extends" ToolContentModel and UnknownContentModel is used by the toolFactory function
// above. Because of this it is a kind of circular dependency.
// If UnknownContentModel is moved to its own module this circular dependency causes an error.
// If they are in the same module then this isn't a problem.
//
// There is a still an "unknown-content" module, so that module can
// register the tool without adding a circular dependency on tool-content-info here.
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