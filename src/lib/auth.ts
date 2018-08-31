import * as jwt from "jsonwebtoken";
import * as queryString from "query-string";
import * as superagent from "superagent";

const DEV_USER: StudentUser = {
  type: "student",
  id: "123",
  firstName: "Sofia",
  lastName: "Q.",
  fullName: "Sofia Q.",
  className: "Geometry (3rd)",
};

export interface RawUser {
  id: string;
  first_name: string;
  last_name: string;
}

export interface StudentUser {
  type: "student";
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
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

export interface BasePortalJWT {
  alg: string;
  iat: number;
  exp: number;
  uid: number;
}

export interface PortalJWT extends BasePortalJWT {
  domain: string;
  user_type: "learner";
  user_id: string;
  learner_id: number;
  class_info_url: string;
  offering_id: number;
}

export const getErrorMessage = (err: any, res: superagent.Response) => {
  return (res.body ? res.body.message : null) || err;
};

const PORTAL_JWT_URL_SUFFIX = "api/v1/jwt/portal";

export const getPortalJWTWithBearerToken = (domain: string, type: string, token: string) => {
  return new Promise<[string, PortalJWT]>((resolve, reject) => {
    const url = `${domain}${PORTAL_JWT_URL_SUFFIX}`;
    superagent
      .get(url)
      .set("Authorization", `${type} ${token}`)
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
            };
            return student;
          }),
        };

        resolve(classInfo);
      }
    });
  });
};

export const authenticate = (devMode: boolean, token?: string, domain?: string) => {
  return new Promise<StudentUser | null>((resolve, reject) => {
    if (devMode) {
      resolve(DEV_USER);
    }

    if (!token) {
      return reject("No token provided for authentication (must launch from Portal)");
    }

    if (!domain) {
      return reject("Missing domain query parameter (required when token parameter is present)");
    }

    return getPortalJWTWithBearerToken(domain, "Bearer", token)
      .then(([rawJWT, portalJWT]) => {
        const classInfoUrl = portalJWT.class_info_url;

        return getClassInfo(classInfoUrl, rawJWT)
          .then((classInfo) => {
            let user: StudentUser | null = null;
            classInfo.students.forEach((student) => {
              if (student.id === portalJWT.user_id) {
                user = student;
              }
            });
            if (!user) {
              reject("Current user not found in class roster");
            }

            resolve(user);
          });
      })
      .catch((e) => {
        reject(e);
      });
  });
};

export const _private = {
  DEV_USER,
  PORTAL_JWT_URL_SUFFIX
};
