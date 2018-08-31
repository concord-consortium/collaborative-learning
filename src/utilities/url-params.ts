import { parse } from "query-string";

interface QueryParams {
  // devMode === "true" or "1" for auto-authentication as developer
  devMode?: string;
  // ordinal string, e.g. "2.1", "3.2", etc.
  problem?: string;
  // nonce (short-lived token) from portal for authentication
  token?: string;
  // The domain of the portal opening the app
  domain?: string;
}

export const urlParams: QueryParams = parse(location.search);
