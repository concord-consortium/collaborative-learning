import { parse } from "query-string";
import { AppMode, AppModes } from "../models/stores/store-types";
import { DBClearLevel } from "../lib/db";

export interface QueryParams {
  // appMode is "authed", "test" or "dev" with the default of dev
  appMode?: AppMode;
  // string, e.g. "sas" for Stretching and Shrinking or "msa" for Moving Straight Ahead
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
  // the user ID of the user launching from the portal domain
  domain_uid?: string;

  // If this exists then the demo ui is shown
  demo?: boolean;

  // Optional name of the demo to use as a namespace under the demo key
  demoName?: string;

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
  // teacher network development features
  //

  // name of teacher network to associate teacher with (until we have a real implementation)
  network?: string;
  // if present without a value show actual (under development) chat implementation
  // if present with value "fixtures" include fake messages for development purposes
  chat?: boolean | "fixtures";

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

  // direct firebase realtime database access to the emulator
  firebase?: string; // "emulator" or host:port url
  // direct firestore access to the emulator
  firestore?: string; // "emulator" or host:port url
  // direct firebase function calls to the emulator
  functions?: string; // "emulator" or host:port url
}

export const processUrlParams = (): QueryParams => {
  const params = parse(location.search);
  return {
    ...params,
    // validate appMode
    appMode: (typeof params.appMode === "string") && AppModes.includes(params.appMode as AppMode)
                  ? params.appMode as AppMode
                  : undefined,  // appMode will be determined internally
    // allows use of ?demo without a value for demo mode
    demo: (params.demo !== undefined)
  };
};

export const urlParams = processUrlParams();
