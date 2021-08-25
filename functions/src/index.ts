
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { PortalFirebaseJWTClaims } from "./portal-types";
import { postDocumentComment } from "./post-document-comment";

// set to true to enable additional logging
const DEBUG = false;

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

const app = admin.initializeApp({
  databaseURL: "https://collaborative-learning-ec215.firebaseio.com/"
});
const firebase = app.database();
const firestore = app.firestore();

// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs (onRequest)!", {structuredData: true});
//   response.send("Hello from Firebase onRequest!");
// });

// interface IHelloCallerParams {
//   caller?: string;
// }
// export const helloCaller = functions.https.onCall((data: IHelloCallerParams, context) => {
//   const { caller } = data;
//   const message = `Hello ${caller} from Firebase onCall!`;
//   functions.logger.info(`LOG: ${message}`, {structuredData: true});
//   return message;
// });

// contents of context.auth?.token in firebase callable functions
type IDecodedIdToken = admin.auth.DecodedIdToken & Partial<PortalFirebaseJWTClaims>;

/*
 * postDocumentComment
 *
 * Posts a comment to a document in firestore, adding metadata for the document to firestore if necessary.
 * The _v1 suffix allows us to version the API if necessary moving forward.
 */
export const postDocumentComment_v1 = functions.https.onCall(postDocumentComment);

/*
 * TODO: Clean up this file so it's just wrapping and forwarding functions defined in their own modules,
 * the way postDocumentComment() is handled above. I'm leaving things alone for now because I don't want
 * to get sucked into refactoring/retesting the getImageData() function at this time.
 */

// relevant contents of multi-class support document in firestore
interface IFirestoreSupportPublication {
  classes: string[];
  context_id: string;   // classHash
  platform_id: string;  // portal, e.g. "learn.concord.org"
}

// parameters passed to getImageData() function by client
interface IGetImageDataParams {
  url: string;
  appMode: string;
  demoName: string;
  portal: string;
  classHash: string;
  classPath: string;
  type?: string;
  key?: string;
}
interface IGetImageDataProcessedParams {
  url: string;
  isValidMode: boolean;
  hasValidClaims: boolean;
  classHash: string;
  classPath: string;
  supportPath?: string;
}
function processGetImageDataParams(
          data: IGetImageDataParams, context: functions.https.CallableContext): IGetImageDataProcessedParams {
  // these values are provided by the client and so should be considered potentially suspect
  const { url, appMode, demoName, portal: _portal, classHash, classPath, type, key } = data;
  // these claim values come from the JWT and so should be considered verified/authenticated
  // they won't be present in dev/demo/qa modes, however, where security isn't a concern
  const claims: IDecodedIdToken | undefined = context.auth?.token;
  const portal: string = claims?.platform_id ||
                          (_portal === "demo" ? demoName : _portal) ||
                          "";
  const portalPath = portal
                      .replace(/^https?:?\/?\/?/, "")
                      .replace(/\./g, "_");
  const classPathParts = classPath.split("/");
  const classPathIncludesAppMode = classPathParts[1] === appMode;
  // for authenticated users, claims must match values passed by client
  const hasValidPortalClaim = !!claims?.platform_id && portal.includes(claims?.platform_id);
  const hasValidClassClaim = !!claims?.class_hash && (claims?.class_hash === classHash);
  const hasValidClassPath = classPathIncludesAppMode &&
                            classPath.includes(portalPath) &&
                            !!claims?.class_hash &&
                            classPath.includes(claims.class_hash);
  const hasValidClaims = hasValidPortalClaim && hasValidClassClaim && hasValidClassPath;
  const isValidMode = classPathIncludesAppMode &&
                        (["demo", "dev", "qa", "test"].includes(appMode) ||
                        ((appMode === "authed") && hasValidClaims));

  DEBUG &&
    console.log("claimsPortal:", claims?.platform_id, "clientPortal:", _portal, "isValid:", hasValidPortalClaim);
  DEBUG &&
    console.log("claimsClassHash:", claims?.class_hash, "clientClass:", classHash, "isValid:", hasValidClassClaim);
  DEBUG &&
    console.log("classPath:", classPath, "appMode:", appMode, "portalPath:", portalPath, "isValid:", hasValidClassPath);

  return {
    url,
    isValidMode,
    hasValidClaims,
    classHash: claims?.class_hash || classHash,
    classPath,
    supportPath: isValidMode && portalPath && key && (type === "supportPublication")
                  ? `/${appMode}/${portalPath}/mcsupports/${key}`
                  : undefined
  };
}
async function getClassPathPartsConsideringSupport(classHash: string, classPath: string, supportPath?: string) {
  const classPathParts = classPath.split("/");
  // if this is a cross-class teacher support, determine image path from support
  if (supportPath) {
    // read the contents of the support document from firestore
    DEBUG && console.log("supportDoc:", "docPath:", supportPath);
    const supportDoc = await firestore.doc(supportPath).get();
    const contents: IFirestoreSupportPublication | undefined = supportDoc.data() as any;
    if (contents) {
      // user's classHash must be in list of classes for support document
      if (contents?.classes.includes(classHash) && contents.context_id) {
        // replace requester's classHash with the support's classHash (context_id)
        classPathParts.splice(classPathParts.length - 1, 1);
        classPathParts.push(contents.context_id);
      }
      else {
        // requesting user is not in class that has access to this support or its images
        console.warn("ERROR: insufficient access!");
        return;
      }
    }
    // If we get here, we couldn't read the firestore support document.
    // It could be an old single-class teacher support, so read it normally.
  }
  return classPathParts;
}
function getImagePath(url: string, classPathParts: string[]) {
  const urlParts = url.split("/");
  const imageKey = urlParts[urlParts.length - 1];
  return `${classPathParts.join("/")}/images/${imageKey}`;
}
async function getImagePathFromSupport(url: string, classHash: string, classPath: string, supportPath?: string) {
  const classPathParts = await getClassPathPartsConsideringSupport(classHash, classPath, supportPath);
  return classPathParts && getImagePath(url, classPathParts);
}
export const getImageData = functions.https.onCall(async (data: IGetImageDataParams, context) => {
  const { url, isValidMode, classHash, classPath, supportPath } = processGetImageDataParams(data, context);

  // clients claiming to be authenticated must have matching claims
  if (!isValidMode) {
    console.warn("ERROR: invalid mode/claims!");
    return null;
  }

  // If we get here, either
  // 1. We are authenticated and have the claims to prove it or
  // 2. We are not authenticated (e.g. dev/demo/qa/...) in which case only unsecured
  //    parts of the firebase/firestore databases should be accessible.

  // determine image path in realtime database
  const imagePath = await getImagePathFromSupport(url, classHash, classPath, supportPath);
  if (!imagePath) return null;
  DEBUG && console.log("imagePath:", imagePath);

  // read the image data from firebase realtime database
  const imageRef = firebase.ref(imagePath);
  const snapshot = await imageRef.once("value");
  if (!snapshot) console.warn(`ERROR: invalid path: ${imagePath}!`);
  return snapshot?.val();
});
