const DEFAULT_PORTAL_URL = "https://learn.concord.org";
/** Must match the OAuth client registered in the portal for the admin page. */
export const OAUTH_CLIENT_ID = "seismic-admin";
const ACCESS_TOKEN_KEY = "seismic-admin-portal-access-token";

/** Portal base URL: the ?portal= param (bare host or full URL) or the default portal. */
export function getPortalUrl(): string {
  const param = new URLSearchParams(window.location.search).get("portal");
  return param ? `https://${param.replace(/^https?:\/\//, "")}` : DEFAULT_PORTAL_URL;
}

/** OAuth2 implicit-flow authorize URL that redirects back to the current page (hash excluded). */
export function buildAuthorizeUrl(): string {
  const redirectUri = window.location.origin + window.location.pathname + window.location.search;
  return `${getPortalUrl()}/auth/oauth_authorize?response_type=token` +
    `&client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/** Access token from the OAuth redirect hash (persisting it), else from sessionStorage. */
export function consumeAccessTokenFromLocation(): string | null {
  const match = /access_token=([^&]+)/.exec(window.location.hash);
  if (match) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, match[1]);
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return match[1];
  }
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

/** Exchange a portal access token for the portal-signed Firebase JWT token-service verifies. */
export async function fetchPortalFirebaseJwt(accessToken: string): Promise<string> {
  const url = `${getPortalUrl()}/api/v1/jwt/firebase?firebase_app=token-service`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Portal JWT fetch failed: ${response.status}`);
  return (await response.json()).token;
}
