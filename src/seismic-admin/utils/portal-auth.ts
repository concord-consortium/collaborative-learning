const DEFAULT_PORTAL_URL = "https://learn.concord.org";
/** Must match the OAuth client registered in the portal for the admin page. */
export const OAUTH_CLIENT_ID = "seismic-admin";
const ACCESS_TOKEN_KEY = "seismic-admin-portal-access-token";

/** Portal base URL: the ?portal= param (bare host or full URL) or the default portal. */
export function getPortalUrl(): string {
  const param = new URLSearchParams(window.location.search).get("portal");
  return param ? `https://${param.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : DEFAULT_PORTAL_URL;
}

/** OAuth2 implicit-flow authorize URL that redirects back to the current page (hash excluded). */
export function buildAuthorizeUrl(): string {
  const redirectUri = window.location.origin + window.location.pathname + window.location.search;
  return `${getPortalUrl()}/auth/oauth_authorize?response_type=token` +
    `&client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Access token from the OAuth redirect hash (persisting it with its issuing portal), else from
 * sessionStorage. A stored token is only returned when it was issued by the current portal;
 * a token for a different portal is stale and gets removed. Storage failures are treated as
 * "no stored token" so a storage-disabled browser can still complete the hash flow.
 */
export function consumeAccessTokenFromLocation(): string | null {
  const match = /access_token=([^&]+)/.exec(window.location.hash);
  if (match) {
    try {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify({ portal: getPortalUrl(), token: match[1] }));
    } catch {
      // Persistence is a convenience; a failure here must not break login.
    }
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return match[1];
  }
  try {
    const raw = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (!raw) return null;
    const { portal, token } = JSON.parse(raw) ?? {};
    if (portal === getPortalUrl() && typeof token === "string") return token;
    // Don't replay a token minted by one portal against another; drop the stale entry.
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    return null;
  } catch {
    return null;
  }
}

export function clearAccessToken() {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

/** Token-service environment for envelope uploads; ?tokenServiceEnv=staging for testing. */
export function getTokenServiceEnv(): "staging" | "production" {
  const param = new URLSearchParams(window.location.search).get("tokenServiceEnv");
  return param === "staging" ? "staging" : "production";
}

/** Exchange a portal access token for the portal-signed Firebase JWT token-service verifies. */
export async function fetchPortalFirebaseJwt(accessToken: string): Promise<string> {
  const url = `${getPortalUrl()}/api/v1/jwt/firebase?firebase_app=token-service`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Portal JWT fetch failed: ${response.status}`);
  return (await response.json()).token;
}
