import { types } from "mobx-state-tree";
import { AuthenticatedUser, PortalFirebaseStudentJWT } from "../../lib/auth";
import initials from "initials";
import { parse } from "query-string";

export const UserTypeEnum = types.enumeration("type", ["student", "teacher"]);
export type UserType = typeof UserTypeEnum.Type;

export const PortalClassOffering = types
  .model("PortalClassOffering", {
    classHash: "",
    className: "",
    problemOrdinal: "",
    unitCode: "",
    offeringId: "",
    location: ""
  })
  .views(self => ({
    get problemPath() {
      return `${self.unitCode}/${self.problemOrdinal.replace(".", "/")}`;
    }
  }));

export type IPortalClassOffering = typeof PortalClassOffering.Type;

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
    portalClassOfferings: types.array(PortalClassOffering),
    demoClassHashes: types.array(types.string),
    lastSupportViewTimestamp: types.maybe(types.number),
    lastStickyNoteViewTimestamp: types.maybe(types.number)
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
      if (user.portalClassOfferings) {
        self.portalClassOfferings.replace(user.portalClassOfferings);
      }
      if (user.demoClassHashes?.length) {
        self.demoClassHashes.replace(user.demoClassHashes);
      }
    },
    setLastSupportViewTimestamp(timestamp: number) {
      self.lastSupportViewTimestamp = timestamp;
    },
    setLastStickyNoteViewTimestamp(timestamp: number) {
      self.lastStickyNoteViewTimestamp = timestamp;
    }
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
    },
    get offeringUrl() {
      const offering = self.portalClassOfferings.find(o => o.offeringId === self.offeringId);
      const parsed = offering?.location ? parse(offering?.location) : undefined;
      return parsed?.offering || undefined;
    }
  }))
  .views((self) => ({
    classHashesForProblemPath(problemPath: string) {
      const classSet = new Set<string>([self.classHash]);
      if (self.isTeacher) {
        // authenticated teachers pull class hashes from portalClassOfferings
        if (self.portalClassOfferings.length) {
          self.portalClassOfferings.forEach(o => {
            if (o.classHash && (o.problemPath === problemPath)) {
              classSet.add(o.classHash);
            }
          });
        }
        // non-authenticated teachers (e.g. demo/qa) pull from demoClassHashes
        else if (self.demoClassHashes.length) {
          self.demoClassHashes.forEach(hash => classSet.add(hash));
        }
      }
      return [...classSet];
    }
  }));

export type UserModelType = typeof UserModel.Type;
