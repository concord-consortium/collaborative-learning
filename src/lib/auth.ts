import initials from "initials";
import jwt_decode from "jwt-decode";
import superagent from "superagent";
import { AppMode } from "../models/stores/store-types";
import { QueryParams, urlParams as pageUrlParams } from "../utilities/url-params";
import { NUM_FAKE_STUDENTS, NUM_FAKE_TEACHERS } from "../components/demo/demo-creator";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { IUserPortalOffering } from "../models/stores/user";
import { UserType } from "../models/stores/user-types";
import { getErrorMessage } from "../utilities/super-agent-helpers";
import { getPortalOfferings, getPortalClassOfferings,  getProblemIdForAuthenticatedUser } from "./portal-api";
import { PortalJWT, PortalFirebaseJWT, IPortalClassInfo } from "./portal-types";
import { Logger } from "../lib/logger";
import { LogEventName } from "../lib/logger-types";
import { uniqueId } from "../utilities/js-utils";
import { getUnitCodeFromUnitParam } from "../utilities/url-utils";
import { convertURLToOAuth2, getBearerToken } from "../utilities/auth-utils";

export const PORTAL_JWT_URL_SUFFIX = "api/v1/jwt/portal";
export const FIREBASE_JWT_URL_SUFFIX = "api/v1/jwt/firebase";
export const FIREBASE_APP_NAME = "collaborative-learning";

export const DEV_STUDENT: StudentUser = {
  type: "student",
  id: "1",
  portal: "localhost",
  firstName: "Dev",
  lastName: "Student",
  fullName: "Dev Student",
  initials: "SD",
  className: "Dev Class",
  classHash: "devclass",
  offeringId: "1",
};

export const DEV_TEACHER: TeacherUser = {
  type: "teacher",
  id: "1000",
  portal: "localhost",
  firstName: "Dev",
  lastName: "Teacher",
  fullName: "Dev Teacher",
  initials: "DT",
  className: "Dev Class",
  classHash: "devclass",
  offeringId: "1",
};

export const DEV_CLASS_INFO: ClassInfo = {
  name: DEV_STUDENT.className,
  classHash: DEV_STUDENT.classHash,
  students: [DEV_STUDENT],
  teachers: [DEV_TEACHER]
};

export type AuthenticatedUser = StudentUser | TeacherUser;
export const isAuthenticatedTeacher = (u: AuthenticatedUser): u is TeacherUser => u.type === "teacher";

interface User {
  id: string;
  portal: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  className: string;
  classHash: string;
  offeringId: string;
  portalJWT?: PortalJWT;
  rawPortalJWT?: string;
  firebaseJWT?: PortalFirebaseJWT;
  rawFirebaseJWT?: string;
  portalClassOfferings?: IUserPortalOffering[];
  demoClassHashes?: string[];
}

export interface StudentUser extends User {
  type: "student";
}

export interface TeacherUser extends User {
  type: "teacher";
  network?: string;     // default network for teacher
  networks?: string[];  // list of networks available to teacher
}

export interface ClassInfo {
  name: string;
  classHash: string;
  students: StudentUser[];
  teachers: TeacherUser[];
}

export interface AuthQueryParams {
  token?: string;
  domain?: string;
}

// An explicitly set appMode takes priority
// Otherwise, assume that local users are devs, unless a token is specified,
// in which authentication is likely being tested
export const getAppMode = (appModeParam?: AppMode, token?: string, host?: string) => {
  return appModeParam != null
           ? appModeParam
           : (token == null && (host === "localhost" || host === "127.0.0.1") ? "dev" : "authed");
};

export const getPortalJWTWithBearerToken = (basePortalUrl: string, type: string, rawToken: string) => {
  return new Promise<[string, PortalJWT]>((resolve, reject) => {
    const resourceLinkIdSuffix =
      pageUrlParams.resourceLinkId ? `?resource_link_id=${ pageUrlParams.resourceLinkId }` : "";
    const url = `${basePortalUrl}${PORTAL_JWT_URL_SUFFIX}${resourceLinkIdSuffix}`;
    superagent
      .get(url)
      .set("Authorization", `${type} ${rawToken}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else if (!res.body || !res.body.token) {
          reject("No token found in JWT request response");
        } else {
          const rawJWT = res.body.token;
          const portalJWT = jwt_decode(rawJWT);
          if (portalJWT) {
            resolve([rawJWT, portalJWT as PortalJWT]);
          } else {
            reject("Invalid portal token");
          }
        }
      });
  });
};

export const getFirebaseJWTParams = (classHash?: string) => {
  const params: Record<string,string> = {
    firebase_app: FIREBASE_APP_NAME
  };
  if (classHash) {
    params.class_hash = classHash;
  }
  if (pageUrlParams.resourceLinkId) {
    params.resource_link_id = pageUrlParams.resourceLinkId;
  }

  return `?${(new URLSearchParams(params)).toString()}`;
};

export const getFirebaseJWTWithBearerToken = (basePortalUrl: string, type: string,
                                              rawToken: string, classHash?: string) => {
  return new Promise<[string, PortalFirebaseJWT]>((resolve, reject) => {
    const url = `${basePortalUrl}${FIREBASE_JWT_URL_SUFFIX}${getFirebaseJWTParams(classHash)}`;
    superagent
      .get(url)
      .set("Authorization", `${type} ${rawToken}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        }
        else if (!res.body || !res.body.token) {
          reject("No Firebase token found in Firebase JWT request response");
        }
        else {
          const {token} = res.body;
          const firebaseJWT = jwt_decode(token);
          if (firebaseJWT) {
            resolve([token, firebaseJWT as PortalFirebaseJWT]);
          }
          else {
            reject("Invalid Firebase token");
          }
        }
      });
  });
};

export interface GetClassInfoParams {
  classInfoUrl: string;
  rawPortalJWT: string;
  portal: string;
  offeringId: string;
}

export const getClassInfo = (params: GetClassInfoParams) => {
  const {classInfoUrl, rawPortalJWT, portal, offeringId} = params;
  return new Promise<ClassInfo>((resolve, reject) => {
    superagent
    .get(classInfoUrl)
    .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
    .end((err, res) => {
      if (err) {
        reject(getErrorMessage(err, res));
      } else if (!res.body || !res.body.class_hash) {
        reject("Invalid class info response");
      } else {
        const rawClassInfo: IPortalClassInfo = res.body;

        const classInfo: ClassInfo = {
          name: rawClassInfo.name,
          classHash: rawClassInfo.class_hash,
          students: rawClassInfo.students.map((rawStudent) => {
            const fullName = `${rawStudent.first_name} ${rawStudent.last_name}`;
            const id = rawStudent.id.split("/").pop() || "0";
            const student: StudentUser = {
              type: "student",
              id,
              portal,
              firstName: rawStudent.first_name,
              lastName: rawStudent.last_name,
              fullName,
              className: rawClassInfo.name,
              initials: initials(fullName) as string,
              classHash: rawClassInfo.class_hash,
              offeringId,
            };
            return student;
          }),
          teachers: rawClassInfo.teachers.map((rawTeacher) => {
            const fullName = `${rawTeacher.first_name} ${rawTeacher.last_name}`;
            const id = rawTeacher.id.split("/").pop() || "0";
            const teacher: TeacherUser = {
              type: "teacher",
              id,
              portal,
              firstName: rawTeacher.first_name,
              lastName: rawTeacher.last_name,
              fullName,
              className: rawClassInfo.name,
              initials: initials(fullName) as string,
              classHash: rawClassInfo.class_hash,
              offeringId,
            };
            return teacher;
          }),
        };

        resolve(classInfo);
      }
    });
  });
};

interface IAuthenticateResponse {
  appMode?: AppMode;
  authenticatedUser: AuthenticatedUser;
  classInfo?: ClassInfo;
  problemId?: string;
  unitCode?: string;
}

export const authenticate = async (appMode: AppMode, appConfig: AppConfigModelType, urlParams?: QueryParams):
    Promise<IAuthenticateResponse> => {
  urlParams = urlParams || pageUrlParams;
  // TODO: we should be defaulting to appConfig.defaultUnit here rather than the empty string,
  // but some cypress tests rely on the fact that in demo mode the offeringId is prefixed with
  // the unit code, which results in an offeringId of `101` instead of `sas101`.
  const unitCode = urlParams.unit || "";
  // when launched as a report, the params will not contain the problemOrdinal
  const problemOrdinal = urlParams.problem || appConfig.defaultProblemOrdinal;
  const bearerToken = getBearerToken(urlParams);
  let basePortalUrl: string;

  let {fakeClass, fakeUser} = urlParams;
  // handle preview launch from portal
  if (urlParams.domain && urlParams.domain_uid && !bearerToken) {
    appMode = "demo";
    fakeClass = `preview-${urlParams.domain_uid}`;
    fakeUser = `student:${urlParams.domain_uid}`;
  }

  if ((appMode === "demo") || (appMode === "qa")) {
    if (!fakeClass || !fakeUser) {
      throw "Missing fakeClass or fakeUser parameter for demo!";
    }
    let [userType, userId] = fakeUser.split(":");

    if (((userType !== "student") && (userType !== "teacher")) || !userId) {
      throw "fakeUser must be in the form of student:<id> or teacher:<id>";
    }

    if ((userId === "random")) {
      const url = window.location.toString();
      const title = document.title;
      const randomStudentId = uniqueId();
      fakeUser = `student:${randomStudentId}`;
      userId = randomStudentId;
      const newUrl = url.replace(/student:random/, fakeUser);
      window.history.replaceState(title, title, newUrl);
    }

    // respect `network` url parameter in demo/qa modes
    const networkProps = urlParams.network
                          ? { network: urlParams.network, networks: [urlParams.network] }
                          : undefined;
    const fakeOfferingId = createFakeOfferingIdFromProblem(unitCode, problemOrdinal);
    return {
      appMode,
      ...createFakeAuthentication({
          appMode,
          classId: fakeClass,
          userType, userId,
          ...networkProps,
          offeringId: fakeOfferingId
        })
    };
  }

  if (appMode !== "authed") {
    return generateDevAuthentication(unitCode || appConfig.defaultUnit, problemOrdinal);
  }

  if (!bearerToken) {
    throw "No token provided for authentication (must launch from Portal)";
  }

  if (urlParams.reportType) {
    if (urlParams.reportType !== "offering") {
      throw "Sorry, only external reports at the offering level are supported";
    }
    if (!urlParams.class) {
      throw "Missing class parameter!";
    }
    if (!urlParams.offering) {
      throw "Missing offering parameter!";
    }
    const {protocol, host} = parseUrl(urlParams.class);
    basePortalUrl = `${protocol}//${host}/`;
  }
  else if (urlParams.domain) {
    basePortalUrl = urlParams.domain;
  }
  else {
    throw "Missing domain query parameter!";
  }

  const [rawPortalJWT, portalJWT] = await getPortalJWTWithBearerToken(basePortalUrl, "Bearer", bearerToken);

  if (!((portalJWT.user_type === "learner") || (portalJWT.user_type === "teacher"))) {
    throw new Error(`Only student and teacher logins are currently supported! ` +
      `Unsupported type: ${portalJWT.user_type}`);
  }

  const portal = parseUrl(basePortalUrl).host;
  let classInfoUrl: string | undefined;
  let offeringId: string | undefined;

  if (portalJWT.user_type === "learner") {
    classInfoUrl = portalJWT.class_info_url;
    offeringId = `${portalJWT.offering_id}`;
  }
  else if (urlParams && urlParams.class && urlParams.offering) {
    classInfoUrl = urlParams.class;
    offeringId = urlParams.offering.split("/").pop() as string;
  }

  if (!classInfoUrl || !offeringId) {
    throw new Error("Unable to get classInfoUrl or offeringId");
  }

  // Re-Write the URL with OAuth2 parameters
  const oAuth2Url = convertURLToOAuth2(window.location.href, basePortalUrl, offeringId);
  if (oAuth2Url) {
    window.history.replaceState(null, "CLUE", oAuth2Url.toString());
  }

  const classInfo = await getClassInfo({classInfoUrl, rawPortalJWT, portal, offeringId});
  const { user_type, uid, domain } = portalJWT;
  const { classHash } = classInfo;
  const uidAsString = `${portalJWT.uid}`;
  const firebaseJWTPromise = getFirebaseJWTWithBearerToken(basePortalUrl, "Bearer", bearerToken, classHash);
  const portalOfferingsPromise = getPortalOfferings(user_type, uid, domain, rawPortalJWT);
  const problemIdPromise = getProblemIdForAuthenticatedUser(rawPortalJWT, appConfig, urlParams);

  const [firebaseJWTResult, portalOfferingsResult, problemIdResult] =
    await Promise.all([firebaseJWTPromise, portalOfferingsPromise, problemIdPromise]);

  const [rawFirebaseJWT, firebaseJWT] = firebaseJWTResult;
  const { unitCode: newUnitCode, problemOrdinal: newProblemOrdinal } = problemIdResult;

  const authenticatedUser = user_type === "learner"
                              ? classInfo.students.find(student => student.id === uidAsString)
                              : classInfo.teachers.find(teacher => teacher.id === uidAsString);
  if (!authenticatedUser) {
    throw new Error("Current user not found in class roster");
  }

  authenticatedUser.portalJWT = portalJWT;
  authenticatedUser.rawPortalJWT = rawPortalJWT;
  authenticatedUser.firebaseJWT = firebaseJWT;
  authenticatedUser.rawFirebaseJWT = rawFirebaseJWT;
  authenticatedUser.id = uidAsString;
  authenticatedUser.portal = portal;
  authenticatedUser.portalClassOfferings =
    getPortalClassOfferings(portalOfferingsResult, appConfig, urlParams);

  Logger.log(LogEventName.INTERNAL_AUTHENTICATED, {id: authenticatedUser.id, portal});

  return {
    authenticatedUser,
    classInfo,
    unitCode: newUnitCode,
    problemId: newProblemOrdinal
  };
};

export const generateDevAuthentication = (unitCode: string, problemOrdinal: string) => {
  const offeringId = createFakeOfferingIdFromProblem(unitCode, problemOrdinal);
  DEV_STUDENT.offeringId = offeringId;
  DEV_CLASS_INFO.students.forEach((student) => student.offeringId = offeringId);
  DEV_CLASS_INFO.teachers.forEach((teacher) => teacher.offeringId = offeringId);

  let authenticatedUser: AuthenticatedUser = DEV_STUDENT;

  const fakeUser = pageUrlParams.fakeUser;
  if (fakeUser) {
    const [role, fakeId] = fakeUser.split(":");
    if (role === "teacher") {
      authenticatedUser = DEV_TEACHER;
      fakeId && (DEV_TEACHER.id = fakeId);

      // respect `network` url parameter in dev mode
      if (pageUrlParams.network) {
        authenticatedUser.network = pageUrlParams.network;
        authenticatedUser.networks = [pageUrlParams.network];
      }
    }
    else {
      fakeId && (DEV_STUDENT.id = fakeId);
    }
  }

  return {authenticatedUser, classInfo: DEV_CLASS_INFO};
};

export const createFakeOfferingIdFromProblem = (unitParam: string, problemOrdinal: string) => {
  // create fake offeringIds per problem so we keep section documents separate
  const [major, minor] = problemOrdinal.split(".");
  const toNumber = (s: string, fallback: number) => isNaN(parseInt(s, 10)) ? fallback : parseInt(s, 10);
  // Ideally we'd get the unit code from the loaded unit data, but we don't have the unit data
  // yet, and it would complicate things to wait for it to load.
  const offeringPrefix = getUnitCodeFromUnitParam(unitParam);
  return `${offeringPrefix}${(toNumber(major, 1) * 100) + toNumber(minor, 0)}`;
};

export const parseUrl = (url: string) => {
  const parser = document.createElement("a");
  parser.href = url;
  return parser;
};

export interface CreateFakeUserOptions {
  appMode: AppMode;
  classId: string;
  userType: UserType;
  userId: string;
  network?: string;
  offeringId: string;
}

const getFakeClassHash = (appMode: AppMode, classId: string) => {
  return `${appMode}class${classId}`;
};

// for testing purposes, demo teachers each have access to three classes
const getFakeTeacherClassHashes = (appMode: AppMode, classId: string) => {

  // if class id is non-numeric, just return the teacher's own class hash
  const idNum = parseInt(classId, 10);
  if (isNaN(idNum)) return [getFakeClassHash(appMode, classId)];

  // each block of three classes is considered part of the same group,
  // e.g. [class1, class2, class3], [class4, class5, class6], etc.
  const mod3 = (idNum - 1) % 3;
  const idNumBase = idNum - mod3;
  return [idNumBase, idNumBase + 1, idNumBase + 2]
          .map(id => getFakeClassHash(appMode, `${id}`));
};

export const createFakeUser = (options: CreateFakeUserOptions) => {
  const {appMode, classId, userType, userId, network, offeringId} = options;
  const className = `${appMode === "demo" ? "Demo" : "QA"} Class ${classId}`;
  if (userType === "student") {
    const student: StudentUser = {
      type: "student",
      id: userId,
      portal: appMode,
      firstName: "Student",
      lastName: `${userId}`,
      fullName: `Student ${userId}`,
      initials: `S${userId}`,
      className,
      classHash: getFakeClassHash(appMode, classId),
      offeringId,
    };
    return student;
  }
  else {
    const teacher: TeacherUser = {
      type: "teacher",
      id: `${parseInt(userId, 10) + 1000}`,
      portal: appMode,
      firstName: "Teacher",
      lastName: `${userId}`,
      fullName: `Teacher ${userId}`,
      initials: `T${userId}`,
      network,
      className,
      classHash: getFakeClassHash(appMode, classId),
      demoClassHashes: getFakeTeacherClassHashes(appMode, classId),
      offeringId,
    };
    return teacher;
  }
};

export interface CreateFakeAuthenticationOptions {
  appMode: AppMode;
  classId: string;
  userType: UserType;
  userId: string;
  network?: string;
  offeringId: string;
}

export const createFakeAuthentication = (options: CreateFakeAuthenticationOptions) => {
  const {appMode, classId, userType, userId, network: _network, offeringId} = options;
  const network = userType === "teacher"
                    ? _network || (parseInt(userId, 10) > 1 ? "demo-network" : undefined) || undefined
                    : undefined;
  const authenticatedUser = createFakeUser({appMode, classId, userType, network, userId, offeringId});
  const classInfo: ClassInfo = {
    name: authenticatedUser.className,
    classHash: authenticatedUser.classHash,
    students: [],
    teachers: [],
  };
  // Add the random student to the class first and then fill the class
  classInfo.students.push(
    createFakeUser({
      appMode,
      classId,
      userType: "student",
      userId: `${userId}`,
      offeringId
    }) as StudentUser
  );
  for (let i = 1; i <= NUM_FAKE_STUDENTS; i++) {
    if (i.toString() !== userId) {
      classInfo.students.push(
        createFakeUser({
          appMode,
          classId,
          userType: "student",
          userId: `${i}`,
          offeringId
        }) as StudentUser
      );
    }
  }

  for (let i = 1; i <= NUM_FAKE_TEACHERS; i++) {
    classInfo.teachers.push(
      createFakeUser({
        appMode,
        classId,
        userType: "teacher",
        userId: `${i}`,
        // teacher 1 is solo; others are networked
        network: i > 1 ? "demo-network" : undefined,
        offeringId
      }) as TeacherUser
    );
  }
  return {authenticatedUser, classInfo};
};
