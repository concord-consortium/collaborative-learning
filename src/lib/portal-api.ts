import { sortBy } from "lodash";
import superagent from "superagent";
import { safeDecodeURI } from "../utilities/js-utils";
import { getErrorMessage } from "../utilities/super-agent-helpers";
import { QueryParams } from "../utilities/url-params";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { IUserPortalOffering, UserPortalOffering } from "../models/stores/user";
import { IPortalClassInfo, IPortalOffering } from "./portal-types";
import { getAuthParams } from "../utilities/auth-utils";
import { ICurriculumConfig, getProblemOrdinal } from "../models/stores/curriculum-config";
import { maybeAddResearcherParam } from "../utilities/researcher-param";

export const kClassWordPrefix = "clue";

const isClueAssignment = (offering: IPortalOffering) => {
  const clueActivityUrlRegex = /collaborative-learning/;
  const clueActivityNameRegex = /CLUE/;
  const clueDashboardRegex = /CLUE Dashboard/;
  const externalReports = offering.external_reports;
  if (clueActivityUrlRegex.test(offering.activity_url)) {
    return true;
  }
  if (clueActivityNameRegex.test(offering.activity)) {
    return true;
  }
  if (externalReports && externalReports.length > 0) {
    return !!externalReports.find((report) => clueDashboardRegex.test(report.name));
  }
  return false;
};

export const getPortalOfferings = (
  userType: string,
  userId: number,
  domain: string,
  rawPortalJWT: any) => {
  return new Promise<IPortalOffering[]> ((resolve, reject) => {
    if (userType !== "teacher" && userType !== "learner") {
      // If the user is not a teacher or learner (currently could just be a researcher),
      // they have no offerings so just return an empty array.
      resolve([]);
      return;
    }

    // teachers can get their own offerings or those of another user in their classes
    // but learners can only get their own offerings so only pass the user ID
    // if the user is a teacher
    const url = `${domain}api/v1/offerings/${userType === "teacher" ? `?user_id=${userId}` : ""}`;

    superagent
    .get(url)
    .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
    .end((err, res) => {
      if (err) {
        reject(getErrorMessage(err, res));
      } else {
        const thisUsersOfferings = res.body as IPortalOffering[];
        const clueOfferings = thisUsersOfferings.filter(isClueAssignment);
        // clazz_hash is a recent addition to the offerings API -- if it's
        // not present then we have to map from class ID to class hash ourselves
        const hasMissingClassHashes = clueOfferings.some(o => !o.clazz_hash);
        if (hasMissingClassHashes) {
          superagent
          .get(`${domain}api/v1/classes/mine`)
          .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
          .end((err2, res2) => {
            if (err2) {
              reject(getErrorMessage(err2, res2));
            } else {
              const mineClasses = res2.body as IMineClasses;
              // create map from class ID to class hash
              const classHashMap: Record<string, string> = {};
              mineClasses.classes.forEach(c => {
                const match = /\/([^/]+)$/.exec(c.uri);
                const classId = match && match[1];
                if (classId) {
                  classHashMap[classId] = c.class_hash;
                }
              });
              // fill in missing class hashes from map
              clueOfferings.forEach(o => {
                if (!o.clazz_hash && classHashMap[o.clazz_id]) {
                  o.clazz_hash = classHashMap[o.clazz_id];
                }
              });
              resolve(clueOfferings);
            }
          });
        }
        else {
          // class hashes are already present so no further work required
          resolve(clueOfferings);
        }
      }
    });
  });
};

export const joinClass = (domain: string, rawPortalJWT: any, classWord: string) => {
  return new Promise<void> ((resolve, reject) => {
    superagent
      .post(`${domain}api/v1/students/join_class`)
      .send({class_word: classWord})
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          resolve();
        }
      });
    });
};

export const getPortalClasses = (domain: string, rawPortalJWT: any) => {
  return new Promise<IPortalClassInfo[]> ((resolve, reject) => {
    superagent
      .get(`${domain}api/v1/classes/mine`)
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          const classes = (res.body.classes ?? []) as IPortalClassInfo[];
          resolve(classes);
        }
      });
    });
};

export const createPortalOffering = (domain: string, rawPortalJWT: any, classId: number, url: string, name: string) => {
  return new Promise<number>((resolve, reject) => {
    superagent
      .post(`${domain}api/v1/offerings/create_for_external_activity`)
      .send({
        class_id: classId,
        name,
        url,
        append_auth_token: true,
        rule: "clue-standalone"
      })
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          resolve(res.body.id);
        }
      });
  });
};

export const createPortalClass = (domain: string, rawPortalJWT: any) => {
  return new Promise<{id: number, classWord: string}>((resolve, reject) => {
    superagent
      .post(`${domain}api/v1/classes`)
      .send({
        name: "CLUE",
        class_word_prefix: kClassWordPrefix,
        auto_generate_class_word: true,
      })
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          resolve({id: res.body.id, classWord: res.body.class_word});
        }
      });
  });
};

interface IUnitAndProblem {
  unitCode?: string;
  problemOrdinal?: string;
}
export const getProblemIdForAuthenticatedUser =
              (rawPortalJWT: string, curriculumConfig?: ICurriculumConfig, urlParams?: QueryParams) => {
  return new Promise<IUnitAndProblem>((resolve, reject) => {
    if (urlParams && urlParams.offering) {
      superagent
      .get(maybeAddResearcherParam(urlParams.offering))
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          const activityUrl = ((res.body || {}).activity_url) || "";
          resolve({
            unitCode: curriculumConfig?.getUnitCode(activityUrl),
            problemOrdinal: getProblemOrdinal(activityUrl)
          });
        }
      });
    }
    else {
      resolve({
        unitCode: urlParams && urlParams.unit,
        problemOrdinal: urlParams && urlParams.problem
      });
    }
  });
};

// portal API return from /api/v1/classes/mine
interface IMineClass {
  uri: string;
  name: string;
  class_hash: string;
}

interface IMineClasses {
  classes: IMineClass[];
}

export function getPortalClassOfferings(portalOfferings: IPortalOffering[],
                                        appConfig: AppConfigModelType,
                                        curriculumConfig: ICurriculumConfig,
                                        urlParams?: QueryParams) {
  const result: IUserPortalOffering[] = [];
  const addOffering = (offering: IPortalOffering) => {
    if (isClueAssignment(offering) && urlParams) {
      let newLocationUrl = "";
      if (urlParams && urlParams.class && urlParams.offering && urlParams.reportType) {
        const newLocationParams: Record<string, string> = {
          class: urlParams.class.replace(/\/classes\/.*$/, `/classes/${offering.clazz_id}`),
          offering: urlParams.offering.replace(/\/offerings\/.*$/, `/offerings/${offering.id}`),
          reportType: urlParams.reportType,
        };
        const authParams = getAuthParams(urlParams);
        Object.assign(newLocationParams, authParams);
        newLocationUrl = `?${(new URLSearchParams(newLocationParams)).toString()}`;
      } else if (offering.activity_url.includes("/standalone")) {
        // This is a special case for standalone CLUE activities - they have
        // all the information in the URL already, so we can just use that.
        newLocationUrl = offering.activity_url;
      }
      result.push(UserPortalOffering.create({
        classId: `${offering.clazz_id}`,
        classHash: offering.clazz_hash || "",
        className: offering.clazz,
        classUrl: offering.clazz_info_url,
        teacher: offering.teacher,
        activityTitle: offering.activity,
        activityUrl: safeDecodeURI(offering.activity_url),
        problemOrdinal: getProblemOrdinal(offering.activity_url) || appConfig.defaultProblemOrdinal,
        // We require a unit param for portal offerings, so we don't fallback to the default unit here
        unitCode: curriculumConfig?.getUnitCode(offering.activity_url),
        offeringId: `${offering.id}`,
        location: newLocationUrl
      }));
    }
  };
  portalOfferings.forEach(addOffering);
  return sortOfferings(result);
}

// Sorts the offerings by class name (alphabetically) and then by problem ordinal
// within each class.
function sortOfferings(offerings: IUserPortalOffering[]) {
  const sortedByOrdinals = offerings.sort( (a, b) => {
    return numericOrdinal(a) - numericOrdinal(b);
  });
  return sortBy(sortedByOrdinals, e => e.className);
}

// A quick hack to make it easy to compare ordinal values that are actually
// strings composed of dot-separated numbers, like "2.11". This assumes there
// are never more than 1,000 problems in an investigation.
function numericOrdinal(offering: IUserPortalOffering) {
  const ord = offering.problemOrdinal.split(".");
  return parseInt(ord[0], 10) * 1000 + parseInt(ord[1], 10);
}

export const getTeacherJWT = (domain: string, rawPortalJWT: string) => {
  return new Promise<string>((resolve, reject) => {
    superagent
      .get(`${domain}api/v1/jwt/portal?as_teacher=true`)
      .send({
        as_teacher: true
      })
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          resolve(res.body.token);
        }
      });
  });
};

export const getLearnerJWT = (domain: string, rawPortalJWT: string, offeringId: number) => {
  return new Promise<string>((resolve, reject) => {
    superagent
      .get(`${domain}api/v1/jwt/portal?as_learner=true&offering_id=${offeringId}`)
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          resolve(res.body.token);
        }
      });
  });
};
