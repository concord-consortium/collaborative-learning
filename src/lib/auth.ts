import * as jwt from "jsonwebtoken";
import * as superagent from "superagent";
import { AppMode } from "../models/stores/stores";
import { QueryParams, DefaultUrlParams } from "../utilities/url-params";
import { NUM_FAKE_STUDENTS, NUM_FAKE_TEACHERS } from "../components/demo/demo-creator";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { IPortalClassOffering } from "../models/stores/user";
import { getErrorMessage } from "../utilities/super-agent-helpers";
import { getPortalOfferings, getPortalClassOfferings,  getProblemIdForAuthenticatedUser } from "./portal-api";
import { Logger, LogEventName } from "../lib/logger";

const initials = require("initials");

export const PORTAL_JWT_URL_SUFFIX = "api/v1/jwt/portal";
export const FIREBASE_JWT_URL_SUFFIX = "api/v1/jwt/firebase";
export const FIREBASE_JWT_QUERY = "?firebase_app=collaborative-learning";

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

export interface RawUser {
  id: string;
  first_name: string;
  last_name: string;
}

export type AuthenticatedUser = StudentUser | TeacherUser;

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
  portalClassOfferings?: IPortalClassOffering[];
}

export interface StudentUser extends User {
  type: "student";
}

export interface TeacherUser extends User {
  type: "teacher";
}

export interface RawClassInfo {
  uri: string;
  name: string;
  state: string;
  class_hash: string;
  teachers: RawUser[];
  students: RawUser[];
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

export type PortalJWT = PortalStudentJWT | PortalTeacherJWT | PortalUserJWT;

export interface BasePortalJWT {
  alg: string;
  iat: number;
  exp: number;
  uid: number;
}

export interface PortalStudentJWT extends BasePortalJWT {
  domain: string;
  user_type: "learner";
  user_id: string;
  learner_id: number;
  class_info_url: string;
  offering_id: number;
}

// An explicitly set appMode takes priority
// Otherwise, assume that local users are devs, unless a token is specified,
// in which authentication is likely being tested
export const getAppMode = (appModeParam?: AppMode, token?: string, host?: string) => {
  return appModeParam != null
           ? appModeParam
           : (token == null && (host === "localhost" || host === "127.0.0.1") ? "dev" : "authed");
};

export type UserType = "student" | "teacher";

export interface PortalTeacherJWT extends BasePortalJWT {
  domain: string;
  user_type: "teacher";
  user_id: string;
  teacher_id: number;
}

export interface PortalUserJWT extends BasePortalJWT {
  domain: string;
  user_type: "user";
  user_id: string;
  first_name: string;
  last_name: string;
}

export interface PortalFirebaseJWTStudentClaims {
  user_type: "learner";
  user_id: string;
  class_hash: string;
  offering_id: number;
}
export interface PortalFirebaseJWTTeacherClaims {
  user_type: "teacher";
  user_id: string;
  class_hash: string;
}

export type PortalFirebaseJWTClaims = PortalFirebaseJWTStudentClaims | PortalFirebaseJWTTeacherClaims;

export interface BasePortalFirebaseJWT {
  alg: string;
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  uid: string;
  user_id: string;
}

export interface PortalFirebaseStudentJWT extends BasePortalFirebaseJWT {
  domain: string;
  domain_uid: number;
  externalId: number;
  returnUrl: string;
  logging: boolean;
  class_info_url: string;
  claims: PortalFirebaseJWTStudentClaims;
}

export interface PortalFirebaseTeacherJWT extends BasePortalFirebaseJWT {
  domain: string;
  domain_uid: number;
  claims: PortalFirebaseJWTTeacherClaims;
}

export type PortalFirebaseJWT = PortalFirebaseStudentJWT | PortalFirebaseTeacherJWT;

export const getPortalJWTWithBearerToken = (basePortalUrl: string, type: string, rawToken: string) => {
  return new Promise<[string, PortalJWT]>((resolve, reject) => {
    const url = `${basePortalUrl}${PORTAL_JWT_URL_SUFFIX}`;
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
          const portalJWT = jwt.decode(rawJWT);
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
  return `${FIREBASE_JWT_QUERY}${classHash ? `&class_hash=${classHash}` : ""}`;
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
          const firebaseJWT = jwt.decode(token);
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
        const rawClassInfo: RawClassInfo = res.body;

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
              initials: initials(fullName),
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
              initials: initials(fullName),
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

export const authenticate = (appMode: AppMode, appConfig: AppConfigModelType, urlParams?: QueryParams) => {
  interface IAuthenticateResponse {
    authenticatedUser: AuthenticatedUser;
    classInfo?: ClassInfo;
    problemId?: string;
    unitCode?: string;
  }
  // tslint:disable-next-line:max-line-length
  return new Promise<IAuthenticateResponse>((resolve, reject) => {
    urlParams = urlParams || DefaultUrlParams;
    const unitCode = urlParams.unit || "";
    // when launched as a report, the params will not contain the problemOrdinal
    const problemOrdinal = urlParams.problem || appConfig.defaultProblemOrdinal;
    const bearerToken = urlParams.token;
    let basePortalUrl: string;

    if ((appMode === "demo") || (appMode === "qa")) {
      const {fakeClass, fakeUser} = urlParams;
      if (!fakeClass || !fakeUser) {
        return reject("Missing fakeClass or fakeUser parameter for demo!");
      }
      const [userType, userId, ...rest] = fakeUser.split(":");
      if (((userType !== "student") && (userType !== "teacher")) || !userId) {
        return reject("fakeUser must be in the form of student:<id> or teacher:<id>");
      }
      return resolve(createFakeAuthentication({
        appMode,
        classId: fakeClass,
        userType, userId,
        unitCode,
        problemOrdinal
      }));
    }

    if (appMode !== "authed") {
      return resolve(generateDevAuthentication(unitCode, problemOrdinal));
    }

    if (!bearerToken) {
      return reject("No token provided for authentication (must launch from Portal)");
    }

    if (urlParams.reportType) {
      if (urlParams.reportType !== "offering") {
        return reject("Sorry, only external reports at the offering level are supported");
      }
      if (!urlParams.class) {
        return reject("Missing class parameter!");
      }
      if (!urlParams.offering) {
        return reject("Missing offering parameter!");
      }
      const {protocol, host} = parseUrl(urlParams.class);
      basePortalUrl = `${protocol}//${host}/`;
    }
    else if (urlParams.domain) {
      basePortalUrl = urlParams.domain;
    }
    else {
      return reject("Missing domain query parameter!");
    }

    return getPortalJWTWithBearerToken(basePortalUrl, "Bearer", bearerToken)
      .then(([rawPortalJWT, portalJWT]) => {
        if ((portalJWT.user_type === "learner") || (portalJWT.user_type === "teacher")) {
          const portal = parseUrl(basePortalUrl).host;
          let classInfoUrl: string | undefined;
          let offeringId: string | undefined;
          let portalClassOfferings: any;

          if (portalJWT.user_type === "learner") {
            classInfoUrl = portalJWT.class_info_url;
            offeringId = `${portalJWT.offering_id}`;
          }
          else if (urlParams && urlParams.class && urlParams.offering) {
            classInfoUrl = urlParams.class;
            offeringId = urlParams.offering.split("/").pop() as string;
          }

          if (classInfoUrl && offeringId) {
            return (getClassInfo({classInfoUrl, rawPortalJWT, portal, offeringId})
            .then((classInfo) => {
              return getFirebaseJWTWithBearerToken(basePortalUrl, "Bearer", bearerToken, classInfo.classHash)
              .then(([rawFirebaseJWT, firebaseJWT]) => {
                getPortalOfferings(portalJWT.user_type, portalJWT.uid, portalJWT.domain, rawPortalJWT)
                .then(result => {
                  portalClassOfferings = getPortalClassOfferings(result, appConfig, urlParams);
                  const uidAsString = `${portalJWT.uid}`;
                  let authenticatedUser: AuthenticatedUser | undefined;

                  if (portalJWT.user_type === "learner") {
                    authenticatedUser = classInfo.students.find((student) => student.id === uidAsString);
                  } else {
                    authenticatedUser = classInfo.teachers.find((teacher) => teacher.id === uidAsString);
                  }

                  if (authenticatedUser) {
                    authenticatedUser.portalJWT = portalJWT;
                    authenticatedUser.rawPortalJWT = rawPortalJWT;
                    authenticatedUser.firebaseJWT = firebaseJWT;
                    authenticatedUser.rawFirebaseJWT = rawFirebaseJWT;
                    authenticatedUser.id = uidAsString;
                    authenticatedUser.portal = portal;
                    if (portalClassOfferings) {
                      authenticatedUser.portalClassOfferings = portalClassOfferings;
                    }
                    getProblemIdForAuthenticatedUser(rawPortalJWT, appConfig, urlParams)
                    .then( ({ unitCode: newUnitCode, problemOrdinal: newProblemOrdinal }) => {
                      if (authenticatedUser) {
                        Logger.log(LogEventName.INTERNAL_AUTHENTICATED, {id: authenticatedUser.id, portal});
                        resolve({authenticatedUser, classInfo, unitCode: newUnitCode, problemId: newProblemOrdinal});
                      }
                    });
                  } else {
                    reject("Current user not found in class roster");
                  }
                });
              })
              .catch(reject);
            })
          );
        } else {
          reject("Unable to get classInfoUrl or offeringId");
        }
      } else {
        reject("Only student and teacher logins are currently supported!");
      }
    })
    .catch(reject);
  });
};

export const generateDevAuthentication = (unitCode: string, problemOrdinal: string) => {
  const offeringId = createOfferingIdFromProblem(unitCode, problemOrdinal);
  DEV_STUDENT.offeringId = offeringId;
  DEV_CLASS_INFO.students.forEach((student) => student.offeringId = offeringId);
  DEV_CLASS_INFO.teachers.forEach((teacher) => teacher.offeringId = offeringId);

  return {authenticatedUser: DEV_STUDENT, classInfo: DEV_CLASS_INFO};
};

const createOfferingIdFromProblem = (unitCode: string, problemOrdinal: string) => {
  // create fake offeringIds per problem so we keep section documents separate
  const [major, minor, ...rest] = problemOrdinal.split(".");
  const toNumber = (s: string, fallback: number) => isNaN(parseInt(s, 10)) ? fallback : parseInt(s, 10);
  return `${unitCode}${(toNumber(major, 1) * 100) + toNumber(minor, 0)}`;
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
  offeringId: string;
}

export const createFakeUser = (options: CreateFakeUserOptions) => {
  const {appMode, classId, userType, userId, offeringId} = options;
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
      classHash: `${appMode}class${classId}`,
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
      className,
      classHash: `${appMode}class${classId}`,
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
  unitCode: string;
  problemOrdinal: string;
}

export const createFakeAuthentication = (options: CreateFakeAuthenticationOptions) => {
  const {appMode, classId, userType, userId, unitCode, problemOrdinal} = options;
  const offeringId = createOfferingIdFromProblem(unitCode, problemOrdinal);
  const authenticatedUser = createFakeUser({appMode, classId, userType, userId, offeringId});
  const classInfo: ClassInfo = {
    name: authenticatedUser.className,
    classHash: authenticatedUser.classHash,
    students: [],
    teachers: [],
  };
  for (let i = 1; i <= NUM_FAKE_STUDENTS; i++) {
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
  for (let i = 1; i <= NUM_FAKE_TEACHERS; i++) {
    classInfo.teachers.push(
      createFakeUser({
        appMode,
        classId,
        userType: "teacher",
        userId: `${i}`,
        offeringId
      }) as TeacherUser
    );
  }
  return {authenticatedUser, classInfo};
};
