import { localFunctionsHost } from "../../lib/firebase-config";
import { urlParams } from "../../utilities/url-params";

export const getAuthoringApiUrl = (endPoint?: string) => {
  const suffix = endPoint?.startsWith("/") ? endPoint : (endPoint ? `/${endPoint}` : "");

  if (urlParams.functions) {
    const hostname = urlParams.functions === "emulator" ? localFunctionsHost : urlParams.functions;
    // NOTE: this relies on running `firebase use staging` before running the emulator as
    // the emulator uses the project ID to determine the local functions url
    return `${hostname}/collaborative-learning-staging/us-central1/api${suffix}`;
  }

  if (urlParams.firebaseEnv === "staging") {
    return `https://us-central1-collaborative-learning-staging.cloudfunctions.net/api${suffix}`;
  }

  return `https://us-central1-collaborative-learning-ec215.cloudfunctions.net/api${suffix}`;
};
