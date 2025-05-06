import ClientOAuth2 from "client-oauth2";
import { QueryParams, reprocessUrlParams, urlParams } from "./url-params";
import { hashValue } from "./url-utils";

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
const PORTAL_SIGNIN_OR_REGISTER_PATH = "/users/sign_in_or_register";

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
 * Get params needed when constructed additional client URLS. When these client URLs
 * are opened the client will re-authenticate with the portal.
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

/**
 * Handle the OAuth2 flow. If the URL has an authDomain parameter, this will
 * save the current url parameters in session storage and redirect the browser
 * to the authDomain. If the URL has state and access_token hash parameters
 * this is the redirect back from the authDomain, so it saves the accessToken
 * globally and reloads the parameters from session storage.
 *
 * If this function returns true, it is redirecting to the authDomain so the
 * client shouldn't do anything else.
 *
 * @returns true if it is redirecting to the authDomain
 */
type IInitializeAuthorizationResult = {redirectingToAuthDomain?: boolean, authDomain?: string};
export const initializeAuthorization = ({standAlone}: {standAlone?: boolean} = {}): IInitializeAuthorizationResult => {
  // Hash params are used here by the OAuth2 flow instead of query parameters.
  // This is to increase security. Browsers do not send hash params to the server when making
  // the http request. So in this case when the Portal does a browser based redirect back
  // to the client, these state and access_token params should never leave the browser.
  // Most of our clients are hosted on S3 with CloudFront for a CDN. So in our case this means
  // these params are not sent to AWS. Also if a user is using an http proxy these params
  // won't be sent to the proxy either.
  const state = hashValue("state");
  accessToken = hashValue("access_token");

  let authDomain: string|undefined;

  if (accessToken && state) {
    let savedParamString = sessionStorage.getItem(state);

    // in standalone mode, we need to remove the authDomain param from the savedParamString
    // once the standalone login is successful.  The authDomain param is used to "kick off"
    // the initial user authentication. We return it so that it can be set in the standalone
    // auth state
    if (savedParamString && standAlone) {
      const savedParams = new URLSearchParams(savedParamString || "");
      authDomain = savedParams.get("authDomain") ?? undefined;
      savedParams.delete("authDomain");
      savedParamString = `?${savedParams.toString()}`;
    }

    window.history.replaceState(null, "CLUE", savedParamString);
    reprocessUrlParams();
  }
  else {
    authDomain = queryValue("authDomain");

    if (authDomain) {
      const key = Math.random().toString(36).substring(2,15);
      sessionStorage.setItem(key, window.location.search);
      authorizeInPortal(authDomain, OAUTH_CLIENT_NAME, key);
      return {redirectingToAuthDomain: true, authDomain};
    }
  }

  return {redirectingToAuthDomain: false, authDomain};
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

/**
 * Convert a token-style launch URL to an OAuth2-friendly URL.
 * The portal currently launches CLUE using a short-lived token. By converting it
 * in this way we can allow reloadin the browser to work even after some time has passed.
 * @param urlString
 * @param basePortalUrl
 * @param offeringId
 * @returns a URL instance if the url is converted, or undefined if it isn't converted
 */
export const convertURLToOAuth2 = (urlString: string, basePortalUrl: string, offeringId: string) => {
  const url = new URL(urlString);
  const searchParams = url.searchParams;
  if (searchParams.get("token") && !searchParams.get("authDomain") && !searchParams.get("resourceLinkId")){
    searchParams.delete("token");
    searchParams.set("authDomain", basePortalUrl.replace(/\/$/,""));
    searchParams.set("resourceLinkId", offeringId);
    url.search = searchParams.toString();
    return url;
  } else {
    return undefined;
  }
};

export const getPortalStandaloneSignInOrRegisterUrl = () => {
  // the default portal URL is the staging portal
  let basePortalUrl = "https://learn.portal.staging.concord.org";

  if (urlParams.portalDomain) {
    // allow the portal root URL to be passed in as a query param for dev/test
    basePortalUrl = urlParams.portalDomain.replace(/\/+$/, "");
  } else {
    const isProduction = window.location.hostname === "collaborative-learning.concord.org";
    const isBranchUrl = window.location.pathname.includes("/branch/");

    if (isProduction && !isBranchUrl) {
      // for production use the production portal
      basePortalUrl = "https://learn.concord.org";
    }
  }

  // pass all the current parameters to the login URL, minus any current auth params
  const cleanedUrl = new URL(removeAuthParams(window.location.href));
  const loginUrlParams = cleanedUrl.searchParams;

  // update the authDomain to be the portal URL
  loginUrlParams.set("authDomain", basePortalUrl);

  if (urlParams.portalDomain) {
    // the portalDomain is passed so that is kept in the return url during development
    // so the developer doesn't have to keep adding it back after the login to retest
    loginUrlParams.set("portalDomain", urlParams.portalDomain);
  }
  const loginUrlQueryString = loginUrlParams.toString();
  const loginUrl = `${window.location.origin}${window.location.pathname}${
    loginUrlQueryString.length > 0 ? `?${loginUrlQueryString}` : ""}`;

  const authParams: URLSearchParams = new URLSearchParams({
    app_name: "CLUE",
    login_url: loginUrl
  });
  if (urlParams.class) {
    // if a class word is passed in (as class), add it to the params so
    // that it can be pre-filled in the student registration
    authParams.append("class_word", urlParams.class);
  }

  return `${basePortalUrl}${PORTAL_SIGNIN_OR_REGISTER_PATH}?${authParams.toString()}`;
};

type RemoveAutParamsOptions = {
  removeClass?: boolean;
  addParams?: Record<string, string>;
}

export const removeAuthParams = (url: string, options?: RemoveAutParamsOptions) => {
  const newUrl = new URL(url);
  const searchParams = newUrl.searchParams;
  searchParams.delete("authDomain");
  searchParams.delete("resourceLinkId");
  searchParams.delete("domain");
  searchParams.delete("domain_uid");
  searchParams.delete("token");
  if (options?.removeClass) {
    searchParams.delete("class");
  }
  if (options?.addParams) {
    Object.entries(options.addParams).forEach(([key, value]) => {
      searchParams.set(key, value);
    });
  }
  newUrl.search = searchParams.toString();
  return newUrl.toString();
};

