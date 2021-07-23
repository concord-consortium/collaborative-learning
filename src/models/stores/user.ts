import initials from "initials";
import { types } from "mobx-state-tree";
import { AuthenticatedUser } from "../../lib/auth";
import { PortalFirebaseStudentJWT } from "../../lib/portal-types";
import { urlParams } from "../../utilities/url-params";
import { UserTypeEnum } from "./user-types";

export const PortalClassOffering = types
  .model("PortalClassOffering", {
    classId: "",
    classHash: "",
    className: "",
    activityTitle: "",
    activityUrl: "",
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
    teacherNetwork: types.maybe(types.string),
    loggingRemoteEndpoint: types.maybe(types.string),
    portalClassOfferings: types.array(PortalClassOffering),
    demoClassHashes: types.array(types.string),
    lastSupportViewTimestamp: types.maybe(types.number),
    lastStickyNoteViewTimestamp: types.maybe(types.number)
  })
  .volatile(self => ({
    isFirebaseConnected: false,
    isLoggingConnected: false
  }))
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
      // TODO: replace this with real implementation
      self.teacherNetwork = user.type === "teacher" ? urlParams.network : undefined;
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
    setIsFirebaseConnected(connected: boolean) {
      self.isFirebaseConnected = connected;
    },
    setIsLoggingConnected(connected: boolean) {
      self.isLoggingConnected = connected;
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
    get isNetworkedTeacher() {
      return (self.type === "teacher") && !!self.teacherNetwork;
    },
    get initials() {
      return initials(self.name);
    },
    get activityUrl() {
      const offering = self.portalClassOfferings.find(o => o.offeringId === self.offeringId);
      return offering?.activityUrl || undefined;
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
