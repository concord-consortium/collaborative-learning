import { types } from "mobx-state-tree";

export const UserModel = types
  .model("User", {
    authenticated: false,
    name: "Anonymous User",
    className: "",
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
