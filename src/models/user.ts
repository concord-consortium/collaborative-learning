import { types } from "mobx-state-tree"

export const User = types.model("User", {
  authenticated: false,
  name: ""
})

export type UserType = typeof User.Type