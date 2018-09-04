import * as jwt from "jsonwebtoken";
import * as queryString from "query-string";
import * as superagent from "superagent";
import { AppMode } from "../models/stores";

const initials = require("initials");

const PORTAL_JWT_URL_SUFFIX = "api/v1/jwt/portal";
const FIREBASE_JWT_URL_SUFFIX = "api/v1/jwt/firebase";
const FIREBASE_JWT_QUERY = "?firebase_app=collaborative-learning";

export const DEV_USER: StudentUser = {
  type: "student",
  id: "123",
  firstName: "Sofia",
  lastName: "Q.",
  fullName: "Sofia Q.",
  initials: "SQ",
  className: "Geometry (3rd)"
};

export interface RawUser {
  id: string;
  first_name: string;
  last_name: string;
}

export type AuthenticatedUser = StudentUser;

interface User {
  id: string;
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
  uri: string;
  name: string;
  state: string;
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
  uid: number;
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

export const getClassInfo = (classInfoUrl: string, rawPortalJWT: string) => {
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
          uri: rawClassInfo.uri,
          name: rawClassInfo.name,
          state: rawClassInfo.state,
          classHash: rawClassInfo.class_hash,
          students: rawClassInfo.students.map((rawStudent) => {
            const fullName = `${rawStudent.first_name} ${rawStudent.last_name}`;
            const student: StudentUser = {
              type: "student",
              id: rawStudent.id,
              firstName: rawStudent.first_name,
              lastName: rawStudent.last_name,
              fullName,
              className: rawClassInfo.name,
              initials: initials(fullName)
            };
            return student;
          }),
        };

        resolve(classInfo);
      }
    });
  });
};

export const authenticate = (appMode: AppMode, token?: string, domain?: string) => {
  return new Promise<AuthenticatedUser>((resolve, reject) => {
    if (appMode !== "authed") {
      resolve(DEV_USER);
    }

    if (!token) {
      return reject("No token provided for authentication (must launch from Portal)");
    }

    if (!domain) {
      return reject("Missing domain query parameter (required when token parameter is present)");
    }

    return getPortalJWTWithBearerToken(domain, "Bearer", token)
      .then(([rawJPortalWT, portalJWT]) => {

        return getFirebaseJWTWithBearerToken(domain, "Bearer", token)
          .then(([rawFirebaseJWT, firebaseJWT]) => {

            if (portalJWT.user_type === "learner") {
              const classInfoUrl = portalJWT.class_info_url;

              return getClassInfo(classInfoUrl, rawJPortalWT)
                .then((classInfo) => {
                  const user = classInfo.students.find((student) => student.id === portalJWT.user_id);
                  if (user) {
                    user.portalJWT = portalJWT;
                    user.rawPortalJWT = rawJPortalWT;
                    user.firebaseJWT = firebaseJWT;
                    user.rawFirebaseJWT = rawFirebaseJWT;
                    user.id = firebaseJWT.user_id;
                    resolve(user);
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

export const _private = {
  DEV_USER,
  PORTAL_JWT_URL_SUFFIX,
  FIREBASE_JWT_URL_SUFFIX,
  FIREBASE_JWT_QUERY,
};
