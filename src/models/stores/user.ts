import { types } from "mobx-state-tree";
import { AuthenticatedUser, PortalFirebaseStudentJWT } from "../../lib/auth";
const initials = require("initials");

export const UserTypeEnum = types.enumeration("type", ["student", "teacher"]);
export type UserType = typeof UserTypeEnum.Type;

export const PortalClass = types.model("PortalClass", {
  className: "",
  classHash: "",
  classUri: ""
});
export type IPortalClass = typeof PortalClass.Type;

export const PortalProblem = types.model("PortalProblem", {
  problemDesignator: "",
  switchUrlLocation: ""
});
export type IPortalProblem = typeof PortalProblem.Type;

export const UserModel = types
  .model("User", {
    authenticated: false,
    id: "0",
    type: types.maybe(UserTypeEnum),
    name: "Anonymous User",
    className: "",
    classHash: "",
    offeringId: "",
    latestGroupId: types.maybe(types.string),
    portal: "",
    loggingRemoteEndpoint: types.maybe(types.string),
    portalClasses: types.array(PortalClass),
    portalProblems: types.array(PortalProblem)
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
      self.latestGroupId = undefined;
      self.id = user.id;
      self.portal = user.portal;
      self.type = user.type;
      self.className = user.className;
      self.classHash = user.classHash;
      self.offeringId = user.offeringId;
      if (user.firebaseJWT && (user.firebaseJWT as PortalFirebaseStudentJWT).returnUrl) {
        self.loggingRemoteEndpoint = (user.firebaseJWT as PortalFirebaseStudentJWT).returnUrl;
      }
      if (user.portalClasses) {
        user.portalClasses.forEach( (portalClass) => {
          self.portalClasses.push(portalClass);
        });
      }
      if (user.portalProblems) {
        user.portalProblems.forEach ( (portalProblem) => {
          self.portalProblems.push(portalProblem);
        });
      }
    },
  }))
  .views((self) => ({
    get isStudent() {
      return self.type === "student";
    },
    get isTeacher() {
      return self.type === "teacher";
    },
    get initials() {
      return initials(self.name);
    }
  }));

export type UserModelType = typeof UserModel.Type;
