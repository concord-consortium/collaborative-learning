import { types } from "mobx-state-tree";
import { AuthenticatedUser } from "../lib/auth";
const initials = require("initials");

export const UserModel = types
  .model("User", {
    authenticated: false,
    id: "0",
    name: "Anonymous User",
    className: "",
    classHash: "",
    offeringId: "",
    latestGroupId: types.maybe(types.string),
    portal: "",
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
    setLatestGroupId(latestGroupId?: string) {
      self.latestGroupId = latestGroupId;
    },
    setId(id: string) {
      self.id = id;
    },
    setAuthenticatedUser(user: AuthenticatedUser) {
      self.authenticated = true;
      self.name = user.fullName;
      self.className = user.className;
      self.latestGroupId = undefined;
      self.id = user.id;
      self.classHash = user.classHash;
      self.offeringId = user.offeringId;
      self.portal = user.portal;
    },
  }))
  .views((self) => ({
    get initials() {
      return initials(self.name);
    }
  }));

export type UserModelType = typeof UserModel.Type;
