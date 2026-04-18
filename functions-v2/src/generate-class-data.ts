// import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {CallableRequest, onCall, HttpsError} from "firebase-functions/v2/https";
import {validateUserContext} from "./user-context";
import {updateSingleClassDataDoc} from "../../shared/update-class-data-docs";
import {IGenerateAiSummaryUnionParams, isWarmUpParams} from "../../shared/shared";

// Create or update the class data doc that contains the summaries of the student and teacher work in a class & unit.
// This will trigger summarization of the content as well by `on-class-data-doc-written`.
// This is normally done by a scheduled daily task, but can be called directly from the client
// for ease of development and testing.

// update this when deploying updates to this function
const version = "1.0.1";

export const generateClassData = onCall(
  {
    maxInstances: 1,
    concurrency: 1,
  },
  async (request: CallableRequest<IGenerateAiSummaryUnionParams>) => {
    const params = request.data;
    if (isWarmUpParams(params)) return {version};
    const {context: userContext, unit} = params || {};

    const validatedUserContext = validateUserContext(userContext, request.auth);
    const {isValid, uid} = validatedUserContext;
    const classHash = userContext?.classHash;
    // Derive the realm from the validated user context rather than trusting the
    // client-provided top-level `portal`/`demo` fields: a stale localStorage
    // demoName can otherwise route an authed session into the wrong realm.
    const portal = userContext?.appMode === "authed" ? userContext.portal : undefined;
    const demo = userContext?.appMode === "demo" ? userContext.demoName : undefined;
    if (!isValid || !classHash || !uid || !unit || (!portal && !demo)) {
      throw new HttpsError("invalid-argument", "The provided arguments are not valid.");
    }

    await updateSingleClassDataDoc(portal, demo, unit, classHash, logger);
    return {success: true};
  },
);
