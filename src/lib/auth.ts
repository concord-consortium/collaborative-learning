import * as jwt from "jsonwebtoken";
import * as queryString from "query-string";
import * as superagent from "superagent";

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

export const getPortalJWTWithBearerToken = (domain: string, type: string, token: string) => {
  return new Promise<[string, PortalJWT]>((resolve, reject) => {
    const url = `${domain}api/v1/jwt/portal`;
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

export const authenticate = (devMode: boolean) => {
  return new Promise<string | null>((resolve, reject) => {
    if (devMode) {
      resolve("Sofia Q.");
    }

    const queryParams: AuthQueryParams = queryString.parse(window.location.search);
    const {token, domain} = queryParams;

    if (!token) {
      return reject("No token provided for authentication (must launch from Portal)");
    }

    if (!domain) {
      return reject("Missing domain query parameter (required when token parameter is present)");
    }

    return getPortalJWTWithBearerToken(domain, "Bearer", token)
      .then(([rawJWT, portalJWT]) => {
        resolve(`User ${portalJWT.learner_id}`);
      });
  });
};
