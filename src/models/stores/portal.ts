import jwt_decode from "jwt-decode";
import superagent from "superagent";
import { IPortalClassInfo, PortalFirebaseJWT, PortalJWT } from "../../lib/portal-types";
import { getErrorMessage } from "../../utilities/super-agent-helpers";
import { convertURLToOAuth2, getBearerToken } from "../../utilities/auth-utils";
import { QueryParams, urlParams as pageUrlParams } from "../../utilities/url-params";
import initials from "initials";
import { IUserPortalOffering } from "./user";

export const parseUrl = (url: string) => {
  const parser = document.createElement("a");
  parser.href = url;
  return parser;
};

export const PORTAL_JWT_URL_SUFFIX = "api/v1/jwt/portal";

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
  localTimestamp: number;
  serverTimestamp?: number;
}

export class Portal {
  rawPortalJWT: string;
  portalJWT: PortalJWT;
  urlParams: QueryParams;
  bearerToken?: string;
  basePortalUrl?: string;
  portalHost: string;
  classInfoUrl: string;
  offeringId: string;
  isPortalPreview = false;

  constructor(urlParams?: QueryParams) {
    this.urlParams = urlParams || pageUrlParams;
    this.bearerToken = getBearerToken(this.urlParams);
    this.isPortalPreview = !!this.urlParams.domain && !!this.urlParams.domain_uid && !this.bearerToken;
  }

  getBasePortalUrl() {
    const {urlParams} = this;
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
      return `${protocol}//${host}/`;
    }
    else if (urlParams.domain) {
      return urlParams.domain;
    }
    else {
      throw "Missing domain query parameter!";
    }
  }

  requestPortalJWT() {
    return new Promise<void>((resolve, reject) => {
      const resourceLinkIdSuffix =
        pageUrlParams.resourceLinkId ? `?resource_link_id=${ pageUrlParams.resourceLinkId }` : "";
      const url = `${this.basePortalUrl}${PORTAL_JWT_URL_SUFFIX}${resourceLinkIdSuffix}`;
      superagent
        .get(url)
        .set("Authorization", `Bearer ${this.bearerToken}`)
        .end((err, res) => {
          if (err) {
            reject(getErrorMessage(err, res));
          } else if (!res.body || !res.body.token) {
            reject("No token found in JWT request response");
          } else {
            const rawJWT = res.body.token;
            const portalJWT = jwt_decode(rawJWT);
            if (portalJWT) {
              this.portalJWT = portalJWT as PortalJWT;
              this.rawPortalJWT = rawJWT;
              resolve();
            } else {
              reject("Invalid portal token");
            }
          }
        });
    });
  }

  async initialize() {
    if (!this.bearerToken) {
      throw "No token provided for authentication (must launch from Portal)";
    }

    this.basePortalUrl = this.getBasePortalUrl();

    await this.requestPortalJWT();

    const {basePortalUrl, portalJWT,urlParams} = this;

    if (!((portalJWT.user_type === "learner") || (portalJWT.user_type === "teacher"))) {
      throw new Error(`Only student and teacher logins are currently supported! ` +
        `Unsupported type: ${portalJWT.user_type}`);
    }

    this.portalHost = parseUrl(basePortalUrl).host;
    if (portalJWT.user_type === "learner") {
      this.classInfoUrl = portalJWT.class_info_url;
      this.offeringId = `${portalJWT.offering_id}`;
    }
    else if (urlParams && urlParams.class && urlParams.offering) {
      this.classInfoUrl = urlParams.class;
      this.offeringId = urlParams.offering.split("/").pop() as string;
    }

    if (!this.classInfoUrl || !this.offeringId) {
      throw new Error("Unable to get classInfoUrl or offeringId");
    }

    // Re-Write the URL with OAuth2 parameters
    const oAuth2Url = convertURLToOAuth2(window.location.href, basePortalUrl, this.offeringId);
    if (oAuth2Url) {
      window.history.replaceState(null, "CLUE", oAuth2Url.toString());
    }
  }

  /**
   * This must be called after initialize()
   *
   * @returns the current class info from the portal
   */
  getClassInfo() {
    const {classInfoUrl, rawPortalJWT, portalHost: portal, offeringId} = this;
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
            localTimestamp: Date.now(),
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
  }
}