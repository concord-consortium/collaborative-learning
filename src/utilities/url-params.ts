import { ParsedQuery, parse } from "query-string";
import { FirebaseEnv } from "../lib/firebase-config";
import { AppMode, AppModes } from "../models/stores/store-types";

export interface QueryParams {
  // appMode is "authed", "test" or "dev" with the default of dev
  appMode?: AppMode;
  // string, e.g. "sas" for Stretching and Shrinking or "msa" for Moving Straight Ahead
  unit?: string;
  // ordinal string, e.g. "2.1", "3.2", etc.
  problem?: string;
  // Used during migration testing to put the app into a "post-migration" mode.
  // In this mode, the new Firebase schema will be used and data is written to a demo portion of Firebase.
  // See `firebase.ts` for more information.
  testMigration?: string;

  //
  // Portal common auth parameters
  //

  // OAuth2 base URL for site providing authentication, replaces token. Typically https://learn.concord.org
  authDomain?: string;
  // If set, this is passed to the portal APIs for JWTs. It should be the offering id that the user is
  // trying to access. The resource link terminology comes from the LTI standard.
  resourceLinkId?: string;
  // short-lived nonce token from portal for authentication
  token?: string;

  //
  // Portal student auth parameters
  //

  // The domain of the portal opening the app
  domain?: string;
  // the user ID of the user launching from the portal domain
  domain_uid?: string;

  //
  // Portal external report auth parameters (classOfferings is ignored)
  //

  // class info url
  class?: string;
  // offering info url
  offering?: string;
  // type of report
  reportType?: string;
  // set to string "true" to authenticate as a researcher
  researcher?: string;
  // display a certain student document, optionally at a point in its history
  studentDocument?: string;
  studentDocumentHistoryId?: string

  // set to user id to target a specific user when logging in as a researcher
  targetUserId?: string;

  //
  // demo features
  //

  // If this exists then the demo ui is shown
  demo?: boolean;
  // Optional name of the demo to use as a namespace under the demo key
  demoName?: string;



  //
  // teacher network development features
  //

  // name of teacher network to associate teacher with (until we have a real implementation)
  network?: string;

  //
  // demo or qa mode parameters
  //

  // class id for demo or qa
  fakeClass?: string;
  // user id  in form (student|teacher):<id>
  fakeUser?: string;

  //
  // QA options
  //

  // group id for qa
  qaGroup?: string;

  // direct firebase realtime database access to the emulator
  firebase?: string; // "emulator" or host:port url
  // Firebase project to use for data and functions
  firebaseEnv?: FirebaseEnv;
  // direct firestore access to the emulator
  firestore?: string; // "emulator" or host:port url
  // direct firebase function calls to the emulator
  functions?: string; // "emulator" or host:port url
  // direct firebase auth to the emulator
  auth?: string; // "emulator" or host:port url
  // do not use persistentUI in some cy tests that rely on demo
  noPersistentUI?: boolean;
  // mouse sensor can be enabled for cypress drag and drop tests for dnd-kit
  mouseSensor?: boolean;

  //
  // Standalone document editor options (doc-editor.html)
  //

  // URL to the document to open in the document editor
  document?: string;
  // Open new documents as readOnly this helps with testing readOnly views
  readOnly?: boolean
  // Just display the document contents, no top toolbar or border
  unwrapped?: boolean
  // Don't load or save the document from browser storage
  noStorage?: boolean
  // Show the "ai summary" button in the document editor
  showAiSummary?: boolean;
  // Include the model in the AI summary
  includeModelInAiSummary?: boolean;

  //
  // Standalone options
  //

  // URL to the portal domain to use for authentication
  portalDomain?: string;
  // the class word for the class that the user is in
  classWord?: string;
}

// Make a union of all of the boolean params from the QueryParams
type BooleanParamNames = Exclude<
  {
    [K in keyof QueryParams]: QueryParams[K] extends boolean | undefined ? K : never
  }[keyof QueryParams],
undefined>;

const booleanParams: BooleanParamNames[] =
  [ "demo", "mouseSensor", "noPersistentUI", "readOnly", "noStorage", "unwrapped" ];

const processBooleanValue = (value: string | (string | null)[] | null | undefined) => {
  if (value === undefined || value === "false") {
    // `undefined` will happen if the parameter isn't specified at all
    // This has to be treated differently from null which will happen when
    // the parameter has no value.
    return false;
  } else {
    // `null` will pass through here
    return true;
  }
};

const processBooleanParams = (params: ParsedQuery<string>) => {
  const result:Record<string, boolean> = {};
  booleanParams.forEach(paramName => {
    result[paramName] = processBooleanValue(params[paramName]);
  });
  return result;
};

export const processUrlParams = (): QueryParams => {
  const params = parse(location.search);
  const processedBooleans = processBooleanParams(params);

  return {
    ...params,
    ...processedBooleans,
    // validate appMode
    appMode: (typeof params.appMode === "string") && AppModes.includes(params.appMode as AppMode)
                  ? params.appMode as AppMode
                  : undefined,  // appMode will be determined internally
  };
};

export const urlParams = processUrlParams();

export const reprocessUrlParams = () => {
  const newParams = processUrlParams();
  // clear the old params
  Object.keys(urlParams).forEach(key => delete (urlParams as any)[key]);
  // add new params
  Object.assign(urlParams, newParams);
};
