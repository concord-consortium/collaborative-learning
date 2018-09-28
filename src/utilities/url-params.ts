import { parse } from "query-string";
import { AppMode } from "../models/stores";
import { DBClearLevel } from "../lib/db";

export interface QueryParams {
  // appMode is "authed", "test" or "dev" with the default of dev
  appMode?: AppMode;
  // ordinal string, e.g. "2.1", "3.2", etc.
  problem?: string;

  //
  // Portal student auth parameters
  //

  // short-lived nonce token from portal for authentication
  token?: string;
  // The domain of the portal opening the app
  domain?: string;

  // If this exists then the demo ui is shown
  demo?: boolean;

  //
  // Portal external report auth parameters (classOfferings is ignored)
  //
  // class info url
  class?: string;
  // offering info url
  offering?: string;
  // type of report
  reportType?: string;

  //
  // demo or qa mode parameters
  //

  // class id for demo or qa
  fakeClass?: string;
  // user id  in form (student|teacher):<id>
  fakeUser?: string;
  // offering id for demo or qa
  fakeOffering?: string;

  //
  // QA options
  //

  // group id for qa
  qaGroup?: string;
  // db level to clear for qa
  qaClear?: DBClearLevel;
}

const params = parse(location.search);
// allows use of ?demo for url
params.demo = typeof params.demo !== "undefined";

export const defaultUrlParams: QueryParams = {
  appMode: "dev",
  problem: undefined,
  token: undefined,
  domain: undefined,
  demo: undefined,
  class: undefined,
  offering: undefined,
  reportType: undefined,
  fakeClass: undefined,
  fakeUser: undefined,
  fakeOffering: undefined,
  qaGroup: undefined,
  qaClear: undefined,
};

export const urlParams: QueryParams = params;
