import initials from "initials";
import { Instance, types } from "mobx-state-tree";
import { AuthenticatedUser, isAuthenticatedTeacher } from "../../lib/auth";
import { PortalFirebaseStudentJWT, PortalJWT, PortalUserJWT } from "../../lib/portal-types";
import { UserType, UserTypeEnum } from "./user-types";

export const UserPortalOffering = types
  .model("UserPortalOffering", {
    classId: "",
    classHash: "",
    className: "",
    classUrl: "",
    teacher: "",
    activityTitle: "",
    activityUrl: "",
    problemOrdinal: "",
    unitCode: "",
    offeringId: "",
    location: ""
  })
  .views(self => ({
    get problemPath() {
      const separator = self.unitCode && self.problemOrdinal ? "/" : "";
      return `${self.unitCode}${separator}${self.problemOrdinal.replace(".", "/")}`;
    }
  }));

export type IStandaloneAuth = undefined |
  {state: "waiting"} |
  {state: "haveBearerToken", bearerToken: string, authDomain: string} |
  {state: "authenticated", rawPortalJWT: string, portalJWT: PortalUserJWT} |
  {state: "error", message: string}
const undefinedStandaloneAuth: IStandaloneAuth = undefined;

export type IStandaloneAuthUser = undefined | {
  rawJWT: string;
  jwt: PortalJWT;
  classId: number;
  offeringId: number;
}
const undefinedStandaloneAuthUser: IStandaloneAuthUser = undefined;

export type IUserPortalOffering = Instance<typeof UserPortalOffering>;

export const UserModel = types
  .model("User", {
    authenticated: false,
    id: "0",
    type: types.maybe(UserTypeEnum),
    name: "Anonymous User",
    className: "",
    classHash: "",
    offeringId: "",
    // This is the last group the user joined. It is synced with the latestGroupId
    // property in Firebase
    latestGroupId: types.maybe(types.string),
    // This is the group of this user in the particular offering that is being
    // run right now. This is the property you usually will want to use.
    // latestGroupId could be referring to a group from a different assignment/offering
    currentGroupId: types.maybe(types.string),
    portal: "",
    network: types.maybe(types.string),
    networks: types.array(types.string),
    loggingRemoteEndpoint: types.maybe(types.string),
    portalClassOfferings: types.array(UserPortalOffering),
    demoClassHashes: types.array(types.string),
    lastSupportViewTimestamp: types.maybe(types.number),
    lastStickyNoteViewTimestamp: types.maybe(types.number)
  })
  .volatile(self => ({
    // in standalone mode, this is defined with a state value
    standaloneAuth: undefinedStandaloneAuth as IStandaloneAuth,
    // at the end of the standalone authentication process, this is set to the JWT of the learner or student
    standaloneAuthUser: undefinedStandaloneAuthUser as IStandaloneAuthUser,

    isFirebaseConnected: false,
    // number of firebase disconnects encountered during the current session
    firebaseDisconnects: 0,
    isLoggingConnected: false,
    // number of logging disconnects encountered during the current session
    loggingDisconnects: 0,
    // number of network status alerts presented during the current session
    networkStatusAlerts: 0
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
    setCurrentGroupId(currentGroupId?: string) {
      self.currentGroupId = currentGroupId;
    },
    setId(id: string) {
      self.id = id;
    },
    setType(type: UserType) {
      self.type = type;
    },
    setNetworks(network: string, networks: string[]) {
      self.network = network;
      self.networks.push(...networks);
    },
    setAuthenticatedUser(user: AuthenticatedUser) {
      self.authenticated = true;
      self.name = user.fullName;
      self.latestGroupId = undefined;
      self.id = user.id;
      self.portal = user.portal;
      self.type = user.type;
      if (isAuthenticatedTeacher(user)) {
        self.network = user.network;
        if (user.networks) {
          self.networks.push(...user.networks);
        }
      }
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
    setStandaloneAuth(value: IStandaloneAuth) {
      self.standaloneAuth = value;
    },
    setStandaloneAuthUser(value: IStandaloneAuthUser) {
      self.standaloneAuthUser = value;
    },
    setIsFirebaseConnected(connected: boolean) {
      if (self.isFirebaseConnected && !connected) ++self.firebaseDisconnects;
      self.isFirebaseConnected = connected;
    },
    setIsLoggingConnected(connected: boolean) {
      if (self.isLoggingConnected && !connected) ++self.loggingDisconnects;
      self.isLoggingConnected = connected;
    },
    incrementNetworkStatusAlertCount() {
      ++self.networkStatusAlerts;
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
    get isResearcher() {
      return self.type === "researcher";
    },
    get isTeacherOrResearcher() {
      return (self.type === "teacher") || (self.type === "researcher");
    },
    get isNetworkedTeacher() {
      return (self.type === "teacher") && !!self.network;
    },
    get initials() {
      return initials(self.name);
    },
    get activityUrl() {
      const offering = self.portalClassOfferings.find(o => o.offeringId === self.offeringId);
      return offering?.activityUrl;
    },

    /**
     * Group documents have a special user id based on the offering and group id.
     * In this way every member of the group will have the same userId for group documents
     *
     * @returns
     */
    get userIdForGroupDocuments() {
      return `group_${self.offeringId}_${self.currentGroupId}`;
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
    },
  }));

export type UserModelType = typeof UserModel.Type;
