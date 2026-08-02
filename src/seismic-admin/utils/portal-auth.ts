const DEFAULT_PORTAL_URL = "https://learn.concord.org";
/** Must match the OAuth client registered in the portal for the admin page. */
export const OAUTH_CLIENT_ID = "seismic-admin";
const LAST_LOGIN_KEY = "seismic-admin-portal-last-login";
/** Auto-login window: a login this recent means the portal session is probably
 *  still alive, so a silent redirect will land back with a fresh token. */
export const AUTO_LOGIN_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/** Portal base URL: the ?portal= param (bare host or full URL) or the default portal. */
export function getPortalUrl(): string {
  const param = new URLSearchParams(window.location.search).get("portal");
  if (!param) return DEFAULT_PORTAL_URL;
  try {
    // Always use https; accept either a bare host or a full URL, but drop any path/query/hash.
    const normalized = `https://${param.replace(/^https?:\/\//, "")}`;
    return new URL(normalized).origin;
  } catch {
    return DEFAULT_PORTAL_URL;
  }
}

/** OAuth2 implicit-flow authorize URL that redirects back to the current page (hash excluded).
 *  The path is canonicalized (no index.html, trailing slash) to match the redirect URIs
 *  registered for the portal's seismic-admin client; the portal errors on any mismatch. */
export function buildAuthorizeUrl(): string {
  const path = window.location.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");
  const redirectUri = window.location.origin + path + window.location.search;
  return `${getPortalUrl()}/auth/oauth_authorize?response_type=token` +
    `&client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Access token from the OAuth redirect hash; null when this page load isn't an
 * OAuth return. The token is held in memory only — never persisted — but the
 * successful login is recorded (portal + time) so a later load can silently
 * re-run the redirect while the portal session is likely still alive. An OAuth
 * error in the hash clears that record so a failed attempt can't loop.
 */
export function consumeAccessTokenFromLocation(): string | null {
  const match = /access_token=([^&]+)/.exec(window.location.hash);
  if (match) {
    saveLastLogin();
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return match[1];
  }
  if (/(^#|[#&])error=/.test(window.location.hash)) {
    clearLastLogin();
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  return null;
}

function saveLastLogin() {
  try {
    localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({ portal: getPortalUrl(), time: Date.now() }));
  } catch {
    // Persistence is a convenience; a failure here must not break login.
  }
}

export function clearLastLogin() {
  try {
    localStorage.removeItem(LAST_LOGIN_KEY);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

/** True when the last successful login was against the current portal within the window. */
export function shouldAutoLogin(): boolean {
  try {
    const raw = localStorage.getItem(LAST_LOGIN_KEY);
    if (!raw) return false;
    const { portal, time } = JSON.parse(raw) ?? {};
    return portal === getPortalUrl() && typeof time === "number" &&
      Date.now() - time < AUTO_LOGIN_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/** Silently re-run the OAuth redirect when the last login is fresh enough.
 *  Returns true when navigation was started (the page is about to unload).
 *  `navigate` is a test seam; production replaces the history entry so Back
 *  from the round-trip doesn't land here and immediately redirect again. */
export function attemptAutoLogin(navigate: (url: string) => void = url => window.location.replace(url)): boolean {
  if (!shouldAutoLogin()) return false;
  navigate(buildAuthorizeUrl());
  return true;
}

/** Token-service environment for envelope uploads; ?tokenServiceEnv=staging for testing. */
export function getTokenServiceEnv(): "staging" | "production" {
  const param = new URLSearchParams(window.location.search).get("tokenServiceEnv");
  return param === "staging" ? "staging" : "production";
}

/** Exchange a portal access token for the portal-signed Firebase JWT token-service verifies. */
export async function fetchTokenServiceJwt(accessToken: string): Promise<string> {
  const url = `${getPortalUrl()}/api/v1/jwt/firebase?firebase_app=token-service`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Portal JWT fetch failed: ${response.status}`);
  return (await response.json()).token;
}
