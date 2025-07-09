import {CallableRequest} from "firebase-functions/v2/https";
import {escapeKey, IUserContext} from "../../shared/shared";

export interface IValidatedUserContext {
  isValid: boolean;
  uid?: string;
  hasValidClaims: boolean;
  // e.g. `authed/<portal>` | `demo/<demoName>` | `dev/<uid>`
  firestoreRoot: string;
  classPath: string;
}

export const canonicalizePortal = (portal: string) => {
  return escapeKey(portal.replace(/^https?:?\/?\/?/, ""));
};

/*
 * getFirebaseClassPath
 *
 * Returns the path to the `classes` folder in the realtime database for the provided user context.
 * Returns the empty string if insufficient information is provided to determine the path.
 * For reasons lost to history the path to the root folder varies in length and content
 * depending on the appMode and certain other things.
 * cf. Firebase.getRootFolder() in `firebase.ts` in client code
 */
export const getFirebaseClassPath = (context?: IUserContext, auth?: CallableRequest<unknown>["auth"]) => {
  if (!context?.appMode || !context.classHash) return "";

  const canonicalPortal = context.portal ? canonicalizePortal(context.portal) : context.portal;
  const escapedDemoName = context.demoName ? escapeKey(context.demoName) : context.demoName;
  let root = "";
  switch (context.appMode) {
  case "authed":
    root = context.portal ? `/authed/portals/${canonicalPortal}` : "";
    break;
  case "demo":
    root = context.demoName ? `/demo/${escapedDemoName}/portals/demo` : "/demo/portals/demo";
    break;
  case "dev":
    root = auth?.uid ? `/dev/${auth.uid}/portals/localhost` : "";
    break;
  case "qa":
    root = auth?.uid ? `/qa/${auth.uid}/portals/qa` : "";
    break;
  case "test":
    root = auth?.uid ? `/test/${auth.uid}/portals/${canonicalPortal || "test"}` : "";
    break;
  }
  if (!root) return "";

  return `${root}/classes/${context.classHash}`;
};

/*
 * getFirestoreRoot
 *
 * Returns the path to the root of the firestore database for the provided user context.
 * Returns the empty string if insufficient information is provided to determine the path.
 * cf. Firestore.getRootFolder() in `firebase.ts` in client code
 */
export const getFirestoreRoot = (context?: IUserContext, auth?: CallableRequest<unknown>["auth"]) => {
  const {appMode, demoName, portal} = context || {};
  if (!appMode) return "";

  const canonicalPortal = portal ? canonicalizePortal(portal) : portal;
  const escapedDemoName = demoName ? escapeKey(demoName) : demoName;
  switch (appMode) {
  case "authed":
    return `authed/${canonicalPortal || ""}`;
  case "demo":
    return `demo/${escapedDemoName || canonicalPortal || "demo"}`;
    // all others use the user's firebase id
  default:
    return auth?.uid ? `${appMode}/${escapeKey(auth.uid)}` : "";
  }
};

/*
 * validateUserContext
 *
 * Validates the provided user context and returns additional information that can be derived from it.
 * Returns a structure which contains:
 * - isValid: boolean
 *      true for authenticated users with validated claims and non-authenticated users
 *        with internally consistent information sufficient to determine a class path;
 *      false for authenticated users with inconsistent or incomplete claims or other problems
 * - uid: string
 *      validated user id for authenticated users; client-provided user id otherwise
 * - hasValidClaims: boolean
 *      true for authenticated users with claims consistent with client-provided information;
 *      false for non-authed clients (that don't have claims) or for authed clients with invalid/inconsistent claims
 * - classPath: string
 *      path to `classes` in the realtime database for the specified user context
 *      empty string in case of invalid, inconsistent, or incomplete information
 */
export const validateUserContext =
              (context?: IUserContext, auth?: CallableRequest<unknown>["auth"]): IValidatedUserContext => {
                // context values are provided by the client and so should be considered potentially suspect
                // claims come from the JWT and are validated by the server when present (only present in authed modes)
                const {appMode, portal, classHash, uid: _uid} = context || {};
                const claims = auth?.token;
                const firestoreRoot = getFirestoreRoot(context, auth);
                const classPath = getFirebaseClassPath(context, auth);
                const classPathParts = classPath.split("/");
                const classPathIncludesAppMode = classPathParts[1] === appMode;
                // for authenticated users, claims must match values passed by client
                const canonicalContextPortal = !!portal && canonicalizePortal(portal);
                const canonicalClaimPortal = !!claims?.platform_id && canonicalizePortal(claims.platform_id);
                const hasValidPortalClaim = !!canonicalClaimPortal && (canonicalClaimPortal === canonicalContextPortal);
                const hasValidClassClaim = !!claims?.class_hash && (claims?.class_hash === classHash);
                const hasValidClassPath = classPathIncludesAppMode &&
                            !!claims?.class_hash &&
                            classPath.includes(claims.class_hash);
                const hasValidUserIdClaim = !!claims?.platform_user_id &&
                                (!_uid || (`${claims.platform_user_id}` === _uid));
                const hasValidClaims = hasValidPortalClaim && hasValidClassClaim &&
                  hasValidClassPath && hasValidUserIdClaim;
                const isValid = classPathIncludesAppMode &&
                    ((!!appMode && ["demo", "dev", "qa", "test"].includes(appMode)) ||
                    ((appMode === "authed") && hasValidClaims));
                const hasValidUserId = hasValidUserIdClaim || (!!_uid && isValid && !claims?.platform_user_id);
                const uid = hasValidUserIdClaim ? `${claims?.platform_user_id}` : hasValidUserId ? _uid : undefined;
                return {isValid, uid, hasValidClaims, firestoreRoot, classPath: isValid ? classPath : ""};
              };
