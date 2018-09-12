import { parse } from "query-string";
import { AppMode } from "../models/stores";

export interface QueryParams {
  // appMode is "authed", "test" or "dev" with the default of dev
  appMode?: AppMode;
  // ordinal string, e.g. "2.1", "3.2", etc.
  problem?: string;
  // short-lived nonce token from portal for authentication
  token?: string;
  // The domain of the portal opening the app
  domain?: string;
  // If this exists then the demo ui is shown
  demo?: boolean;
  // class id for demo
  demoClass?: string;
  // user id from demo in form (student|teacher):<id>
  demoUser?: string;
  // demo offering id
  demoOffering?: string;
}

const params = parse(location.search);
// allows use of ?demo for url
params.demo = typeof params.demo !== "undefined";

export const urlParams: QueryParams = params;
