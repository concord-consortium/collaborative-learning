import { getErrorMessage } from "../utilities/super-agent-helpers";
import superagent from "superagent";
import { safeDecodeURI } from "../utilities/js-utils";
import { QueryParams } from "../utilities/url-params";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { IPortalClassOffering, PortalClassOffering } from "../models/stores/user";
import { sortBy } from "lodash";
import { parseUrl } from "query-string";

interface IPortalReport {
  url: string;
  name: string;
  id: number;
}

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
    return externalReports.find((report) => clueDashboardRegex.test(report.name));
  }
  return false;
};

export const getPortalOfferings = (
  userType: string,
  userId: number,
  domain: string,
  rawPortalJWT: any) => {

  return new Promise<IPortalOffering[]> ((resolve, reject) => {
    // TODO: For now isolate this to the teachers view
    if (userType === "teacher") {
      superagent
      .get(`${domain}api/v1/offerings/?user_id=${userId}`)
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
    }
    else {
      resolve([]);
    }
  });
};

interface IUnitAndProblem {
  unitCode: string;
  problemOrdinal: string;
}
export const getProblemIdForAuthenticatedUser =
              (rawPortalJWT: string, appConfig: AppConfigModelType, urlParams?: QueryParams) => {
  return new Promise<IUnitAndProblem>((resolve, reject) => {
    if (urlParams && urlParams.offering) {
      superagent
      .get(urlParams.offering)
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          const activityUrl = ((res.body || {}).activity_url) || "";
          resolve({
            unitCode: getUnitCode(activityUrl) || appConfig.defaultUnit,
            problemOrdinal: getProblemOrdinal(activityUrl) || appConfig.defaultProblemOrdinal
          });
        }
      });
    }
    else {
      resolve({
        unitCode: urlParams && urlParams.unit || appConfig.defaultUnit,
        problemOrdinal: urlParams && urlParams.problem || appConfig.defaultProblemOrdinal
      });
    }
  });
};

// The portals native format of API returns
export interface IPortalOffering {
  id: number;
  clazz: string;
  clazz_id: number;
  clazz_hash?: string;  // added in recent portal versions
  activity: string;
  activity_url: string;
  external_report?: IPortalReport | null;
  external_reports?: IPortalReport[];
}

// portal API return from /api/v1/classes/mine
interface IMineClass {
  uri: string;
  name: string;
  class_hash: string;
}

interface IMineClasses {
  classes: IMineClass[];
}

// Extracts the problem ordinal from the activity_url. An activity_url is part
// of what the portal returns as an offering and has the problem ordinal at the
// end.

// For problems... e.g. "https://collaborative-learning.concord.org/branch/master/index.html?problem=3.1"
function getProblemOrdinal(url: string) {
  const queryParams = parseUrl(url);
  return queryParams.query.problem
          ? queryParams.query.problem as string
          : undefined;
}

// For units... e.g. "https://collaborative-learning.concord.org/branch/master/index.html?unit=s%2Bs
// for the "Stretching and Shrinking" unit.
function getUnitCode(url: string) {
  const queryParams = parseUrl(url);
  return queryParams.query.unit
          ? queryParams.query.unit as string
          : undefined;
}

export function getPortalClassOfferings(portalOfferings: IPortalOffering[],
                                        appConfig: AppConfigModelType,
                                        urlParams?: QueryParams) {
  const result: IPortalClassOffering[] = [];
  const addOffering = (offering: IPortalOffering) => {
    if (isClueAssignment(offering) && urlParams) {
      let newLocationUrl = "";
      if (urlParams && urlParams.class && urlParams.offering && urlParams.reportType && urlParams.token) {
        newLocationUrl =
          `?class=${urlParams.class.replace(/\/classes\/.*$/, `/classes/${offering.clazz_id}`)}` +
          `&offering=${urlParams.offering.replace(/\/offerings\/.*$/, `/offerings/${offering.id}`)}` +
          `&reportType=${urlParams.reportType}` +
          `&token=${urlParams.token}`;
      }
      result.push(PortalClassOffering.create({
        classId: `${offering.clazz_id}`,
        classHash: offering.clazz_hash || "",
        className: offering.clazz,
        activityTitle: offering.activity,
        activityUrl: safeDecodeURI(offering.activity_url),
        problemOrdinal: getProblemOrdinal(offering.activity_url) || appConfig.defaultProblemOrdinal,
        unitCode: getUnitCode(offering.activity_url) || appConfig.defaultUnit,
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
function sortOfferings(offerings: IPortalClassOffering[]) {
  const sortedByOrdinals = offerings.sort( (a, b) => {
    return numericOrdinal(a) - numericOrdinal(b);
  });
  return sortBy(sortedByOrdinals, e => e.className);
}

// A quick hack to make it easy to compare ordinal values that are actually
// strings composed of dot-separated numbers, like "2.11". This assumes there
// are never more than 1,000 problems in an investigation.
function numericOrdinal(offering: IPortalClassOffering) {
  const ord = offering.problemOrdinal.split(".");
  return parseInt(ord[0], 10) * 1000 + parseInt(ord[1], 10);
}

export const PortalOfferingParser = {
  getProblemOrdinal,
  getUnitCode,
  getPortalClassOfferings
};
