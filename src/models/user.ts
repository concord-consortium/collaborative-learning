import { types } from "mobx-state-tree";

export const UserModel = types
  .model("User", {
    authenticated: false,
    name: types.optional(types.string, "Anonymous User"),
    className: types.maybeNull(types.string),
  })
  .actions((self) => ({
    setName(name: string) {
      self.name = name;
    },
    setAuthentication(auth: boolean) {
      self.authenticated = auth;
    },
    setClassName(className: string) {
      self.className = className;
    },
  }));

export type UserModelType = typeof UserModel.Type;
