import { Portal } from "../models/stores/portal";
import { getFirebaseJWTWithBearerToken } from "./auth";

/** The portal firebase app whose JWTs token-service verifies (via its ADMIN_PUBLIC_KEY). */
export const TOKEN_SERVICE_FIREBASE_APP = "token-service";

/**
 * Returns a getJwt callback (for createEnvelopeCredentialsProvider) that exchanges the
 * session's portal JWT for a portal-signed firebase JWT for the token-service app, or
 * undefined when the session has no portal JWT (dev/demo/qa modes). The portal JWT
 * expires ~1h after launch, so a failed exchange refreshes it via the stored bearer
 * credentials and retries once.
 */
export function makeTokenServiceJwtGetter(portal: Portal): (() => Promise<string>) | undefined {
  const { basePortalUrl } = portal;
  if (!portal.rawPortalJWT || !basePortalUrl) return undefined;
  // Reads rawPortalJWT at call time so the retry below picks up the refreshed value.
  const exchange = async () => {
    const [rawJwt] = await getFirebaseJWTWithBearerToken(
      basePortalUrl, "Bearer/JWT", portal.rawPortalJWT, undefined, TOKEN_SERVICE_FIREBASE_APP);
    return rawJwt;
  };
  return async () => {
    try {
      return await exchange();
    } catch {
      await portal.requestPortalJWT();
      return exchange();
    }
  };
}
