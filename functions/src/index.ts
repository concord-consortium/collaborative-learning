
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { PortalFirebaseJWTClaims } from "./portal-types";

// set to true to enable additional logging
const DEBUG=false;

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

const app = admin.initializeApp({
  // credential: admin.credential.applicationDefault(),
  databaseURL: 'https://collaborative-learning-ec215.firebaseio.com/'
});
const firebase = app.database();
const firestore = app.firestore();

// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

type IDecodedIdToken = admin.auth.DecodedIdToken & Partial<PortalFirebaseJWTClaims>;

interface ISupportPublication {
  classes: string[];
  context_id: string;   // classHash
  platform_id: string;  // portal, e.g. "learn.concord.org"
}

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
export const getImageData = functions.https.onCall(async (data: IGetImageDataParams, context) => {
  // these values are provided by the client and so should be considered potentially suspect
  const { url, appMode, demoName, portal: _portal, classHash: _classHash, classPath, type, key } = data;
  // these claim values come from the JWT and so should be considered verified/authenticated
  // they won't be present in dev/demo/qa modes, however, where security isn't a concern
  const claims: IDecodedIdToken | undefined = context.auth?.token;
  const portal: string = claims?.platform_id ||
                          (_portal === "demo" ? demoName : _portal) ||
                          "";
  const portalPath = portal
                      .replace(/^https?:?\/?\/?/, "")
                      .replace(/\./g, "_");
  const classHash = claims?.class_hash || _classHash;
  const classPathParts = classPath.split("/");
  // for authenticated users, claims must match values passed by client
  const hasValidPortalClaim = claims?.platform_id && portal.includes(claims?.platform_id);
  const hasValidClassClaim = claims?.class_hash && (claims?.class_hash === _classHash);
  const hasValidClassPath = (classPathParts[1] === appMode) &&
                            classPath.includes(portalPath) &&
                            classPath.includes(claims?.class_hash);
  const hasValidClaims = hasValidPortalClaim && hasValidClassClaim && hasValidClassPath;

  DEBUG &&
    console.log("claimsPortal:", claims?.platform_id, "clientPortal:", _portal, "isValid:", hasValidPortalClaim);
  DEBUG &&
    console.log("claimsClassHash:", claims?.class_hash, "clientClass:", _classHash, "isValid:", hasValidClassClaim);
  DEBUG &&
    console.log("classPath:", classPath, "appMode:", appMode, "portalPath:", portalPath, "isValid:", hasValidClassPath);

  // clients claiming to be authenticated must have matching claims
  if ((appMode === "authed") && !hasValidClaims) {
    console.warn("ERROR: invalid claims!");
    return null;
  }

  // If we get here, either
  // 1. We are authenticated and have the claims to prove it or
  // 2. We are not authenticated (e.g. dev/demo/qa/...) in which case only unsecured
  //    parts of the firebase/firestore databases should be accessible.

  // if this is a cross-class teacher support, determine image path from support
  if (appMode && portalPath && key && (type === "supportPublication")) {
    // read the contents of the support document from firestore
    const docPath = `/${appMode}/${portalPath}/mcsupports/${key}`;
    DEBUG && console.log("supportDoc:", "docPath:", docPath);
    const supportDoc = await firestore.doc(docPath).get();
    const contents: ISupportPublication | undefined = supportDoc.data() as any;
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
        return null;
      }
    }
    // If we get here, we couldn't read the firestore support document.
    // It could be an old single-class teacher support, so read it normally.
  }

  // read the image data from firebase realtime database
  const urlParts = url.split("/");
  const imageKey = urlParts[urlParts.length - 1];
  const imagePath = `${classPathParts.join("/")}/images/${imageKey}`;
  DEBUG && console.log("imagePath:", imagePath);
  const imageRef = firebase.ref(imagePath);
  const snapshot = await imageRef.once("value");
  if (!snapshot) console.warn(`ERROR: invalid path: ${imagePath}!`);
  return snapshot?.val();
});
