import * as jwt from "jsonwebtoken";
import * as queryString from "query-string";
import * as superagent from "superagent";
import { AppMode } from "../models/stores";
import { QueryParams } from "../utilities/url-params";
import {NUM_DEMO_STUDENTS} from "../components/demo-creator";

const initials = require("initials");

const PORTAL_JWT_URL_SUFFIX = "api/v1/jwt/portal";
const FIREBASE_JWT_URL_SUFFIX = "api/v1/jwt/firebase";
const FIREBASE_JWT_QUERY = "?firebase_app=collaborative-learning";

export const DEV_USER: StudentUser = {
  type: "student",
  id: "1",
  portal: "localhost",
  firstName: "Sofia",
  lastName: "Q.",
  fullName: "Sofia Q.",
  initials: "SQ",
  className: "Geometry (3rd)",
  classHash: "devclass",
  offeringId: "1",
};

export const DEV_CLASS_INFO: ClassInfo = {
  name: DEV_USER.className,
  classHash: DEV_USER.classHash,
  students: [DEV_USER]
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
  portalJWT?: PortalJWT;
  rawPortalJWT?: string;
  firebaseJWT?: PortalFirebaseJWT;
  rawFirebaseJWT?: string;
}

export interface StudentUser extends User {
  type: "student";
  className: string;
  classHash: string;
  offeringId: string;
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

export const getErrorMessage = (err: any, res: superagent.Response) => {
  return (res.body ? res.body.message : null) || err;
};

export const getPortalJWTWithBearerToken = (domain: string, type: string, rawToken: string) => {
  return new Promise<[string, PortalJWT]>((resolve, reject) => {
    const url = `${domain}${PORTAL_JWT_URL_SUFFIX}`;
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

export const getFirebaseJWTWithBearerToken = (domain: string, type: string, rawToken: string) => {
  return new Promise<[string, PortalFirebaseJWT]>((resolve, reject) => {
    const url = `${domain}${FIREBASE_JWT_URL_SUFFIX}${FIREBASE_JWT_QUERY}`;
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
  offeringId: number;
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
              offeringId: `${offeringId}`,
            };
            return student;
          }),
        };

        resolve(classInfo);
      }
    });
  });
};

export const authenticate = (appMode: AppMode, urlParams?: QueryParams) => {
  return new Promise<{authenticatedUser: AuthenticatedUser, classInfo?: ClassInfo}>((resolve, reject) => {
    const {token, domain} = urlParams || {token: undefined, domain: undefined};

    if (appMode !== "authed") {
      if (appMode === "demo") {
        urlParams = urlParams || {demoClass: undefined, demoUser: undefined, demoOffering: undefined};
        const {demoClass, demoUser, demoOffering} = urlParams;
        if (!demoClass || !demoUser || !demoOffering) {
          return reject("Missing demoClass or demoUser or demoOffering parameter for demo!");
        }
        const [userType, userId, ...rest] = demoUser.split(":");
        if (((userType !== "student") && (userType !== "teacher")) || !userId) {
          return reject("demoUser must be in the form of student:<id> or teacher:<id>");
        }
        resolve(createDemoInfo(demoClass, userType, userId, demoOffering));
      }

      resolve({authenticatedUser: DEV_USER, classInfo: DEV_CLASS_INFO});
    }

    if (!token) {
      return reject("No token provided for authentication (must launch from Portal)");
    }

    if (!domain) {
      return reject("Missing domain query parameter (required when token parameter is present)");
    }

    return getPortalJWTWithBearerToken(domain, "Bearer", token)
      .then(([rawPortalJWT, portalJWT]) => {

        return getFirebaseJWTWithBearerToken(domain, "Bearer", token)
          .then(([rawFirebaseJWT, firebaseJWT]) => {

            if (portalJWT.user_type === "learner") {
              const classInfoUrl = portalJWT.class_info_url;

              const domainParser = document.createElement("a");
              domainParser.href = portalJWT.domain;
              const portal = domainParser.hostname;

              return getClassInfo({classInfoUrl, rawPortalJWT, portal, offeringId: portalJWT.offering_id})
                .then((classInfo) => {
                  const uidAsString = `${portalJWT.uid}`;
                  const authenticatedUser = classInfo.students.find((student) => student.id === uidAsString);
                  if (authenticatedUser) {
                    authenticatedUser.portalJWT = portalJWT;
                    authenticatedUser.rawPortalJWT = rawPortalJWT;
                    authenticatedUser.firebaseJWT = firebaseJWT;
                    authenticatedUser.rawFirebaseJWT = rawFirebaseJWT;
                    authenticatedUser.id = `${portalJWT.uid}`;
                    authenticatedUser.portal = portal;
                    resolve({authenticatedUser, classInfo});
                  }
                  else {
                    reject("Current user not found in class roster");
                  }
                });
            }
            else {
              reject("Only student logins are currently supported!");
            }
          })
          .catch(reject);
      })
      .catch(reject);
  });
};

export const createDemoUser = (classId: string, userType: UserType, userId: string, offeringId: string) => {
  if (userType === "student") {
    const student: StudentUser = {
      type: "student",
      id: userId,
      portal: "demo",
      firstName: "Student",
      lastName: `${userId}`,
      fullName: `Student ${userId}`,
      initials: `S${userId}`,
      className: `Demo Class ${classId}`,
      classHash: `democlass${classId}`,
      offeringId,
    };
    return student;
  }
  else {
    const teacher: TeacherUser = {
      type: "teacher",
      id: userId,
      portal: "demo",
      firstName: "Student",
      lastName: `${userId}`,
      fullName: `Student ${userId}`,
      initials: `S${userId}`
    };
    return teacher;
  }
};

export const createDemoInfo = (classId: string, userType: UserType, userId: string, offeringId: string) => {
  const authenticatedUser = createDemoUser(classId, userType, userId, offeringId);
  const classInfo: ClassInfo = {
    name: `Demo Class ${classId}`,
    classHash: `democlass${classId}`,
    students: []
  };
  for (let i = 1; i <= NUM_DEMO_STUDENTS; i++) {
    classInfo.students.push(createDemoUser(classId, "student", `${i}`, offeringId) as StudentUser);
  }
  return {authenticatedUser, classInfo};
};

export const _private = {
  DEV_USER,
  PORTAL_JWT_URL_SUFFIX,
  FIREBASE_JWT_URL_SUFFIX,
  FIREBASE_JWT_QUERY,
};
