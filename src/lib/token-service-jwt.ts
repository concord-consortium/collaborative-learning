import { Portal } from "../models/stores/portal";
import { getFirebaseJWTWithBearerToken } from "./auth";

/** The portal firebase app whose JWTs token-service verifies (via its ADMIN_PUBLIC_KEY). */
export const TOKEN_SERVICE_FIREBASE_APP = "token-service";

/**
 * Returns a getJwt callback (for createEnvelopeCredentialsProvider) that obtains a
 * portal-signed firebase JWT for the token-service app, or undefined when the session
 * has no way to get one.
 *
 * Portal-authenticated sessions exchange the session's portal JWT. The portal JWT
 * expires ~1h after launch, so a failed exchange refreshes it via the stored bearer
 * credentials and retries once.
 *
 * Demo/qa sessions launched with an authDomain parameter have no portal JWT, but the
 * OAuth round-trip leaves an access token on the portal store; that bearer token is
 * exchanged directly (as the seismic-admin does). There is no refresh path for an
 * expired access token, so the exchange is not retried — reloading the page re-runs
 * the OAuth flow.
 */
export function makeTokenServiceJwtGetter(portal: Portal): (() => Promise<string>) | undefined {
  const { basePortalUrl, bearerToken } = portal;

  if (portal.rawPortalJWT && basePortalUrl) {
    // Reads rawPortalJWT at call time so the retry below picks up the refreshed value.
    const exchange = async () => {
      const [rawJwt] = await getFirebaseJWTWithBearerToken(
        basePortalUrl, "Bearer/JWT", portal.rawPortalJWT, undefined, TOKEN_SERVICE_FIREBASE_APP);
      return rawJwt;
    };
    return async () => {
      try {
        return await exchange();
      } catch (error) {
        console.warn("Token-service JWT exchange failed; refreshing the portal JWT:", error);
        await portal.requestPortalJWT();
        return exchange();
      }
    };
  }

  const authDomain = portal.urlParams?.authDomain;
  if (bearerToken && authDomain) {
    const base = authDomain.endsWith("/") ? authDomain : `${authDomain}/`;
    return async () => {
      const [rawJwt] = await getFirebaseJWTWithBearerToken(
        base, "Bearer", bearerToken, undefined, TOKEN_SERVICE_FIREBASE_APP);
      return rawJwt;
    };
  }

  return undefined;
}
