import { types } from "mobx-state-tree"

export const UserModel = types
  .model("User", {
    authenticated: false,
    name: types.maybeNull(types.string)
  })
  .actions(self => ({
    setName(name: string) {
      self.name = name
    }
  }))

export type UserModelType = typeof UserModel.Type
