import { parse } from "query-string";

export const urlParams = parse(location.search);
