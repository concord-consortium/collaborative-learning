import { useCallback } from "react";
import { localFunctionsHost } from "../../lib/firebase-config";
import { urlParams } from "../../utilities/url-params";
import { Auth } from "./use-auth";

export type GetEndPoint =
  "/whoami" |
  "/getContent" |
  "/getRemoteBranches" |
  "/getRemoteUnits" |
  "/getPulledBranches" |
  "/getPulledUnits" |
  "/getPulledFiles";

export type PostEndPoint =
  "/pullUnit" |
  "/pushUnit" |
  "/putContent" |
  "/putImage";

export type EndPoint = GetEndPoint | PostEndPoint;

export interface ApiSuccessResponse {
  success: true;
  [key: string]: any;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiParams = Record<string, string>;

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export interface AuthoringApi {
  get: (endpoint: GetEndPoint, queryParams?: ApiParams, options?: RequestInit)
    => Promise<ApiResponse>;
  post: (endpoint: PostEndPoint, queryParams?: ApiParams, body?: any, options?: RequestInit)
    => Promise<ApiResponse>;
}

function useAuthoringApi(auth: Auth): AuthoringApi {

  const getBaseUrl = () => {
    if (urlParams.functions) {
      const hostname = urlParams.functions === "emulator" ? localFunctionsHost : urlParams.functions;
      // NOTE: this relies on running `firebase use staging` before running the emulator as
      // the emulator uses the project ID to determine the local functions url
      return `${hostname}/collaborative-learning-staging/us-central1/api`;
    }

    if (urlParams.firebaseEnv === "staging") {
      return "https://us-central1-collaborative-learning-staging.cloudfunctions.net/api";
    }

    return "https://us-central1-collaborative-learning-ec215.cloudfunctions.net/api";
  };

  // eslint-disable-next-line max-len
  const apiFetch = useCallback(async (method: "GET" | "POST", endpoint: EndPoint, queryParams: ApiParams = {}, options: RequestInit = {}): Promise<ApiResponse> => {
    const firebaseToken = auth.firebaseToken;
    const gitHubToken = auth.gitHubToken;
    if (!firebaseToken) {
      throw new Error("Failed to get Firebase authentication token");
    }
    if (!gitHubToken) {
      throw new Error("GitHub token is not available");
    }
    queryParams = { ...queryParams, gitHubToken };

    const url = new URL(`${getBaseUrl()}${endpoint}`);
    url.search = new URLSearchParams(queryParams).toString();

    const response = await fetch(url.toString(), {
      ...options,
      method,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${firebaseToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }, [auth.firebaseToken, auth.gitHubToken]);

  // eslint-disable-next-line max-len
  const get = async (endpoint: GetEndPoint, queryParams: ApiParams = {}, options: RequestInit = {}): Promise<ApiResponse> =>
    apiFetch("GET", endpoint, queryParams, options);

  // eslint-disable-next-line max-len
  const post = async (endpoint: PostEndPoint, queryParams: ApiParams = {}, body: any = {}, options: RequestInit = {}): Promise<ApiResponse> =>
    apiFetch("POST", endpoint, queryParams, { ...options, body: JSON.stringify(body) });

  return { get, post };
}

export default useAuthoringApi;
