import { getErrorMessage } from "../utilities/super-agent-helpers";
import * as superagent from "superagent";
import * as queryString from "query-string";
import { QueryParams } from "../utilities/url-params";
import { IClueClassOffering } from "../models/stores/user";
import { sortBy } from "lodash";

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
          const clueOfferings = thisUsersOfferings.filter(offering => isClueAssignment(offering));
          resolve(clueOfferings);
        }
      });
    }
    else {
      resolve([]);
    }
  });
};

export const getProblemIdForAuthenticatedUser = (rawPortalJWT: string, urlParams?: QueryParams) => {
  return new Promise<string|undefined>((resolve, reject) => {
    if (urlParams && urlParams.offering) {
      superagent
      .get(urlParams.offering)
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          const activityUrl = ((res.body || {}).activity_url) || "";
          const [ignore, query, ...rest] = activityUrl.split("?");
          const params = queryString.parse(query);
          resolve(params.problem as string);
        }
      });
    }
    else {
      resolve(undefined);
    }
  });
};

// The portals native format of API returns
interface IPortalOffering {
  id: number;
  clazz: string;
  clazz_id: number;
  activity: string;
  activity_url: string;
  external_report?: IPortalReport | null;
  external_reports?: IPortalReport[];
}

// Extracts the problem ordinal from the activity_url. An activity_url is part
// of what the portal returns as an offering and has the problem ordinal at the
// end, e.g. "https://collaborative-learning.concord.org/branch/master/index.html?problem=3.1"
function getProblemOrdinal(offering: IPortalOffering) {
  const defaultOrdinal = "x.x.x";
  const problemRegEx = /problem=(\d\.\d)/;
  const result = problemRegEx.exec(offering.activity_url);
  if (result && result[1]) {
    return (result[1] as string) || defaultOrdinal;
  }
  return defaultOrdinal;
}

export function getClueClassOfferings(portalOfferings: IPortalOffering[], urlParams?: QueryParams) {
  const result = [] as IClueClassOffering[];
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
      result.push({
        className: offering.clazz,
        problemOrdinal: getProblemOrdinal(offering),
        offeringId: `${offering.id}`,
        location: newLocationUrl
      });
    }
  };
  portalOfferings.forEach(addOffering);
  return sortOfferings(result);
}

// Sorts the offerings by class name (alphabetically) and then by problem ordinal
// within each class.
function sortOfferings(offerings: IClueClassOffering[]) {
  const sortedByOrdinals = offerings.sort( (a, b) => {
    return numericOrdinal(a) - numericOrdinal(b);
  });
  return sortBy(sortedByOrdinals, e => e.className);
}

// A quick hack to make it easy to compare ordinal values that are actually
// strings composed of dot-separated numbers, like "2.11". This assumes there
// are never more than 10,000 problems in an investigation.
function numericOrdinal(offering: IClueClassOffering) {
  const ord = offering.problemOrdinal.split(".");
  return parseInt(ord[0], 10) * 10000 + parseInt(ord[1], 10);
}

export const PortalOfferingParser = {
  getProblemOrdinal,
  getClueClassOfferings
};
