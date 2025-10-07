import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useAuth } from "./use-auth";
import { getAuthoringApiUrl } from "../utils/authoring-api";

export type GetEndPoint =
  | "/whoami"
  | "/getContent"
  | "/getRemoteBranches"
  | "/getRemoteUnits"
  | "/getPulledBranches"
  | "/getPulledUnits"
  | "/getPulledFiles";

export type PostEndPoint =
  | "/pullUnit"
  | "/pushUnit"
  | "/putContent"
  | "/putImage";

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
  get: (
    endpoint: GetEndPoint,
    queryParams?: ApiParams,
    options?: RequestInit
  ) => Promise<ApiResponse>;
  post: (
    endpoint: PostEndPoint,
    queryParams?: ApiParams,
    body?: any,
    options?: RequestInit
  ) => Promise<ApiResponse>;
}

// Create the context
const AuthoringApiContext = createContext<AuthoringApi | undefined>(undefined);

// Provider component
export const AuthoringApiProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const auth = useAuth();
  const apiFetch = useCallback(
    async (
      method: "GET" | "POST",
      endpoint: EndPoint,
      queryParams: ApiParams = {},
      options: RequestInit = {}
    ): Promise<ApiResponse> => {
      if (!auth.firebaseToken) {
        throw new Error("Failed to get Firebase authentication token");
      }
      if (!auth.gitHubToken) {
        throw new Error("GitHub token is not available");
      }

      queryParams = { ...queryParams, gitHubToken: auth.gitHubToken };
      const url = new URL(getAuthoringApiUrl(endpoint));
      url.search = new URLSearchParams(queryParams).toString();

      const response = await fetch(url.toString(), {
        ...options,
        method,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${auth.firebaseToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return response.json();
    },
    [auth.firebaseToken, auth.gitHubToken]
  );

  const api = useMemo<AuthoringApi>(
    () => ({
      get: (endpoint, queryParams = {}, options = {}) =>
        apiFetch("GET", endpoint, queryParams, options),
      post: (endpoint, queryParams = {}, body = {}, options = {}) =>
        apiFetch("POST", endpoint, queryParams, {
          ...options,
          body: JSON.stringify(body),
        }),
    }),
    [apiFetch]
  );

  return (
    <AuthoringApiContext.Provider value={api}>
      {children}
    </AuthoringApiContext.Provider>
  );
};

// Hook to use the API
export const useAuthoringApi = (): AuthoringApi => {
  const context = useContext(AuthoringApiContext);
  if (!context) {
    throw new Error("useAuthoringApi must be used within an AuthoringApiProvider");
  }
  return context;
};
