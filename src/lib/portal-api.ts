import { getErrorMessage } from "../utilities/super-agent-helpers";
import * as superagent from "superagent";
import { IPortalClass, IPortalProblem } from "../models/stores/user";
import * as queryString from "query-string";
import { QueryParams } from "../utilities/url-params";
import { IClueClassOffering } from "../models/stores/user";

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

export const getPortalProblems = (
    userType: string,
    userId: number,
    domain: string,
    rawPortalJWT: any,
    urlParams?: QueryParams): Promise<IPortalProblem[] | undefined> => {
  return new Promise<IPortalProblem[] | undefined>((resolve, reject) => {
    if (userType === "teacher" && urlParams && urlParams.class) {
      superagent
      .get(`${domain}api/v1/offerings/?user_id=${userId}`)
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          const classId = (urlParams.class!).split("/classes/").pop();
          const problemsAssignedThisClass =
            res.body.filter( (activity: any) =>
              `${activity.clazz_id}` === classId &&
              /^https:\/\/collaborative-learning/.test(activity.activity_url) );
          const portalProblems: IPortalProblem[] = problemsAssignedThisClass.map( (activity: any) => {
            return (
              {
                problemDesignator: activity.activity_url.match(/\?problem=(.+)/)[1],
                switchUrlLocation:
                  `?class=${urlParams.class}` +
                  `&offering=${urlParams.offering!.replace(/\/offerings\/.*$/, `/offerings/${activity.id}`)}` +
                  `&reportType=${urlParams.reportType}` +
                  `&token=${urlParams.token}`
              }
            );
          });
          resolve((portalProblems.length > 0) ? portalProblems : undefined);
        }
      });
    }
    else {
      resolve(undefined);
    }
  });
};

export const getPortalClasses = (
  userType: string,
  rawPortalJWT: any,
  urlParams?: QueryParams): Promise<IPortalClass[]> => {
  return new Promise<IPortalClass[]>((resolve, reject) => {
    if (userType === "teacher" && urlParams && urlParams.class) {
      const url = urlParams.class.replace(/classes\/\d*$/, "classes/mine");
      superagent
      .get(url)
      .set("Authorization", `Bearer/JWT ${rawPortalJWT}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else {
          const portalClasses = res.body.classes.map( (rawPortalClass: any) => {
            return (
              {
                className: rawPortalClass.name,
                classHash: rawPortalClass.class_hash,
                classUri: rawPortalClass.uri,
              }
            );
          });
          resolve(portalClasses);
        }
      });
    }
    else {
      resolve(undefined);
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
  clazz: string;
  clazz_id: number;
  activity: string;
  activity_url: string;
  external_report?: IPortalReport | null;
  external_reports?: IPortalReport[];
}

// TODO Better way to extract external report url.
function getClueDashboardUrl(offering: IPortalOffering) {
  const report =  offering.external_report || offering.external_reports && offering.external_reports[0];
  return (report && report.url) || null;
}

// TODO Better way to extract problemId. Add sample activity_url.
function getProblemOrdinal(offering: IPortalOffering) {
  const defaultOrdinal = "x.x.x";
  const query = offering.activity_url.split("?")[1];
  if (query) {
    const params = queryString.parse(query);
    return (params.problem as string) || defaultOrdinal;
  }
  return defaultOrdinal;
}

export function getClueClassOfferings(portalOfferings: IPortalOffering[]): IClueClassOffering[] {
  const result = [] as IClueClassOffering[];
  const addOffering = (offering: IPortalOffering) => {
    if (isClueAssignment(offering)) {
      result.push({
        className: offering.clazz,
        dashboardUrl: getClueDashboardUrl(offering) || "",
        problemOrdinal: getProblemOrdinal(offering)
      });
    }
  };
  portalOfferings.forEach(addOffering);
  return result;
}

export function getProblemLinkForClass(clueOfferings: IClueClassOffering[], className: string, problemOrdinal: string) {
  const clazzProblems = clueOfferings.filter( o => o.className === className);
  if (clazzProblems) {
    const problem: IClueClassOffering | null  =
      clazzProblems.find( (p: IClueClassOffering) =>  p.problemOrdinal === problemOrdinal)
      || clazzProblems[0];
    if (problem) {
      return problem;
    }
  }
  // tslint:disable-next-line
  console.error(`class ${className} doesn't have Clue Problem offerings.`);
  return null;
}

export const PortalOfferingParser = {
  getDashboardUrl: getClueDashboardUrl,
  getProblemOrdinal,
  getClueClassOfferings,
  getProblemLinkForClass
};
