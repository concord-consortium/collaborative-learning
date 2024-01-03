import ClientOAuth2 from "client-oauth2";
import { hashValue, QueryParams, reprocessUrlParams, urlParams } from "./url-params";

// Portal has to have AuthClient configured with this clientId.
// The AuthClient has to have:
// - redirect URLs of domain being tested:
//   https://collaborative-learning.concord.org/branch/master/
//   https://collaborative-learning.concord.org/branch/other-feature-branch/
//   http://localhost:8080/
//   ...
// - "client type" needs to be configured as 'public', to allow browser requests
const OAUTH_CLIENT_NAME = "clue";
const PORTAL_AUTH_PATH = "/auth/oauth_authorize";

let accessToken: string | undefined;

// Only return string or undefined
const queryValue = (param: keyof QueryParams, overriddenUrlParams?: QueryParams) => {
  const localUrlParams = overriddenUrlParams || urlParams;
  const val = localUrlParams[param];
  if (!val) return;

  if (val === true) {
    return val.toString();
  }
  return val;
};

/**
 * Get a bearer token to be used with the Portal APIs.
 *
 * If launched from the portal, this will be the `token` param in the URL.
 * If using OAuth2 this will be the accessToken provided by the OAuth2 flow.
 *
 * @param sourceUrlParams the urlParams to get the bearer token from if there
 * is no accessToken.
 */
export const getBearerToken = (sourceUrlParams: QueryParams) => {
  return accessToken || queryValue("token", sourceUrlParams);
};

/**
 * Get params needed when constructed CLUE URLs, so CLUE will be re-authenticate with the
 * portal.
 *
 * Notes: A token param from a student launch is only valid for 3 minutes.
 * A token param from a teacher dashboard launch is valid for 2 hours.
 *
 * @param sourceUrlParams the set of params to look for the auth in. They are passed in
 * so this is easier to test.
 */
export const getAuthParams = (sourceUrlParams: QueryParams) => {
  const { authDomain, resourceLinkId, token } = sourceUrlParams;
  if (authDomain) {
    return { authDomain, resourceLinkId };
  }
  if (token) {
    return { token };
  }

  return {};
};

// Returns true if it is redirecting
export const initializeAuthorization = () => {
  const state = hashValue("state");
  accessToken = hashValue("access_token");

  if (accessToken && state) {
    const savedParamString = sessionStorage.getItem(state);
    window.history.pushState(null, "CLUE", savedParamString);
    reprocessUrlParams();
  }
  else {
    const authDomain = queryValue("authDomain");

    if (authDomain) {
      const key = Math.random().toString(36).substring(2,15);
      sessionStorage.setItem(key, window.location.search);
      authorizeInPortal(authDomain, OAUTH_CLIENT_NAME, key);
      return true;
    }
  }
  return false;
};

export const authorizeInPortal = (portalUrl: string, oauthClientName: string, state: string) => {
  const portalAuth = new ClientOAuth2({
    clientId: oauthClientName,
    redirectUri: window.location.origin + window.location.pathname,
    authorizationUri: `${portalUrl}${PORTAL_AUTH_PATH}`,
    state
  });
  // Redirect
  window.location.assign(portalAuth.token.getUri());
};
