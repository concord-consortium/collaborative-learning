import { types } from "mobx-state-tree";

export const UserModel = types
  .model("User", {
    authenticated: false,
    name: "Anonymous User",
    className: "",
    group: types.maybe(types.string),
  })
  .actions((self) => ({
    setName(name: string) {
      self.name = name;
    },
    setAuthenticated(auth: boolean) {
      self.authenticated = auth;
    },
    setClassName(className: string) {
      self.className = className;
    },
    setGroup(groupName: string) {
      self.group = groupName;
    }
  }));

export type UserModelType = typeof UserModel.Type;
