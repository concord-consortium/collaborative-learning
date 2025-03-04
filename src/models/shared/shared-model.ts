import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { uniqueId } from "../../utilities/js-utils";

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
.views(self => ({
  get name(): string|undefined {
    // Overridden by subclasses that support storing a name.
    // If unsupported, should always return undefined.
    return undefined;
  }
}))
.actions(self => ({
  setIndexOfType(index: number) {
    self.indexOfType = index;
  },
  setName(name: string) {
    // Overridden by subclasses that support storing a name.
    throw "This SharedModel type does not implement setName";
  }
}));

export interface SharedModelType extends Instance<typeof SharedModel> {}
export type SharedModelSnapshotType = SnapshotIn<typeof SharedModel>;
