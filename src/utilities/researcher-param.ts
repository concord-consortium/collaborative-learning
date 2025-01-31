import { urlParams } from "./url-params";

export const isResearcher = () => urlParams.researcher === "true";

export const maybeAddResearcherParam = (url: string): string => {
  if (isResearcher()) {
    const parsedUrl = new URL(url);
    const queryParams = new URLSearchParams(parsedUrl.search);
    queryParams.set("researcher", "true");
    parsedUrl.search = queryParams.toString();
    return parsedUrl.toString();
  } else {
    return url;
  }
};
