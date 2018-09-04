import { types } from "mobx-state-tree";
import { AuthenticatedUser } from "../lib/auth";

export const UserModel = types
  .model("User", {
    authenticated: false,
    name: "Anonymous User",
    className: "",
    group: types.maybeNull(types.string),
    id: types.maybeNull(types.string),
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
    setGroup(group: string | null) {
      self.group = group;
    },
    setId(id: string | null) {
      self.id = id;
    },
    setAuthenticatedUser(user: AuthenticatedUser) {
      self.authenticated = true;
      self.name = user.fullName;
      self.className = user.className;
      self.group = null;
      self.id = user.id;
    },
  }));

export type UserModelType = typeof UserModel.Type;
