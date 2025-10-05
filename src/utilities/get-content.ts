import { getAuthoringApiUrl } from "../authoring/utils/authoring-api";
import { urlParams } from "./url-params";

export const getContent = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  // If there is an `authoringBranch` param, rewrite the URL to fetch from the authoring API's
  // `rawContent` endpoint overriding the branch to use the `authoringBranch` value.
  if (urlParams.authoringBranch) {
    const url = typeof input === "string" ? input : input.url;
    const matches = url.match(/\/clue-curriculum\/branch\/([^/]+)\/(.+)$/);
    if (matches) {
      const authoringUrl = getAuthoringApiUrl(`/rawContent/${urlParams.authoringBranch}/${matches[2]}`);
      if (typeof input === "string") {
        input = authoringUrl;
      } else {
        input = {...input, url: authoringUrl};
      }
    }
  }

  return fetch(input, init);
};
