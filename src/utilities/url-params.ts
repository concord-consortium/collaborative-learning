import { parse } from "query-string";
import { AppMode } from "../models/stores/stores";
import { DBClearLevel } from "../lib/db";
import { assign } from "lodash";

export const DefaultProblemOrdinal = "2.1";

export interface QueryParams {
  // appMode is "authed", "test" or "dev" with the default of dev
  appMode?: AppMode;
  // string, e.g. "s&s" for Stretching and Shrinking or "msa" for Moving Straight Ahead
  unit?: string;
  // ordinal string, e.g. "2.1", "3.2", etc.
  problem?: string;
  // Used during migration testing to put the app into a "post-migration" mode.
  // In this mode, the new Firebase schema will be used and data is written to a demo portion of Firebase.
  // See `firebase.ts` for more information.
  testMigration?: string;

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

  //
  // QA options
  //

  // group id for qa
  qaGroup?: string;
  // db level to clear for qa
  qaClear?: DBClearLevel;

  // Dataflow mode
  dataflow?: boolean;
}

const params = parse(location.search);

export const DefaultUrlParams: QueryParams = {
  appMode: "dev",
  unit: undefined,
  problem: undefined,
  token: undefined,
  domain: undefined,
  demo: undefined,
  class: undefined,
  offering: undefined,
  reportType: undefined,
  fakeClass: undefined,
  fakeUser: undefined,
  qaGroup: undefined,
  qaClear: undefined,
  testMigration: undefined,
};
                                                    // allows use of ?demo for url
export const urlParams: QueryParams = assign(params, { demo: typeof params.demo !== "undefined" });
