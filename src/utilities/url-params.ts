import { parse } from "query-string";
import { AppMode } from "../models/stores";

interface QueryParams {
  // appMode is "authed", "test" or "dev" with the default of dev
  appMode?: AppMode;
  // ordinal string, e.g. "2.1", "3.2", etc.
  problem?: string;
  // nonce (short-lived token) from portal for authentication
  token?: string;
  // The domain of the portal opening the app
  domain?: string;
}

export const urlParams: QueryParams = parse(location.search);
