import { parse } from "query-string";

interface QueryParams {
  devMode?: string;
  problem?: string;
}

export const urlParams: QueryParams = parse(location.search);
