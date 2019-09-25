import { getErrorMessage } from "../utilities/super-agent-helpers";
import * as superagent from "superagent";
import * as queryString from "query-string";
import { QueryParams } from "../utilities/url-params";
import { IPortalClassOffering } from "../models/stores/user";
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
          resolve(clueOfferings);
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
export const getProblemIdForAuthenticatedUser = (rawPortalJWT: string, urlParams?: QueryParams) => {
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
            unitCode: getUnitCode(activityUrl),
            problemOrdinal: getProblemOrdinal(activityUrl)});
        }
      });
    }
    else {
      // TODO FIXME: Use default values for unitCode and problemOrdinal ?
      resolve({ unitCode: "undefined", problemOrdinal: "undefined" });
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
// end.

// For problems... e.g. "https://collaborative-learning.concord.org/branch/master/index.html?problem=3.1"
function getProblemOrdinal(url: string) {
  const defaultOrdinal = "x.x.x";
  const queryParams = parseUrl(url);
  const problemOrdinal = queryParams.query.problem as string;
  if (! problemOrdinal) {
    // tslint:disable-next-line
    console.warn(`Missing problemOrdinal. Using default: ${defaultOrdinal}`);
    return (defaultOrdinal);
  }
  return (problemOrdinal);
}

// For units... e.g. "https://collaborative-learning.concord.org/branch/master/index.html?unit=s%2Bs
// for the "Stretching and Shrinking" unit.
function getUnitCode(url: string) {
  const defaultUnit = "s+s";
  const queryParams = parseUrl(url);
  const unit = queryParams.query.unit as string;
  if (! unit) {
    // tslint:disable-next-line
    console.warn(`Missing unitCode. Using default: ${defaultUnit}`);
    return (defaultUnit);
  }
  return (unit);
}

export function getPortalClassOfferings(portalOfferings: IPortalOffering[], urlParams?: QueryParams) {
  const result = [] as IPortalClassOffering[];
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
        problemOrdinal: getProblemOrdinal(offering.activity_url),
        unitCode: getUnitCode(offering.activity_url),
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
