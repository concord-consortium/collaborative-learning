import { parse } from "query-string";
import { AppMode, AppModes } from "../models/stores/store-types";
import { DBClearLevel } from "../lib/db";

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
  // db level to clear for qa
  qaClear?: DBClearLevel;

  // direct firebase realtime database access to the emulator
  firebase?: string; // "emulator" or host:port url
  // direct firestore access to the emulator
  firestore?: string; // "emulator" or host:port url
  // direct firebase function calls to the emulator
  functions?: string; // "emulator" or host:port url
  // do not use persistentUI in some cy tests that rely on demo
  noPersistentUI?: boolean;
  // mouse sensor can be enabled for cypress drag and drop tests for dnd-kit
  mouseSensor?: boolean;

  //
  // CMS options (admin.html)
  //

  // change the branch used in clue-curriculum repository default is author
  curriculumBranch?: string;
  // work with a local checkout of the curriculum instead of github
  localCMSBackend?: boolean;
  // change the location of the cms-editor.html used by iframe widget to edit
  // CLUE documents.
  cmsEditorBase?: string;

  //
  // Standalone document editor options (doc-editor.html)
  //

  // URL to the document to open in the document editor
  document?: string;
}

export const processUrlParams = (): QueryParams => {
  const params = parse(location.search);
  return {
    ...params,
    // validate appMode
    appMode: (typeof params.appMode === "string") && AppModes.includes(params.appMode as AppMode)
                  ? params.appMode as AppMode
                  : undefined,  // appMode will be determined internally
    // allows use of ?demo without a value for demo mode
    demo: (params.demo !== undefined),
    // allows use of localCMSBackend without a value
    localCMSBackend: (params.localCMSBackend !== undefined),
    // disables persistentUI store initialization
    noPersistentUI: (params.noPersistentUI !== undefined)
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

/**
 * Simplifies query-string library by only returning `string | undefined`, instead
 * of `string | string[] | null | undefined`.
 * @param prop
 */
export function hashValue(prop: string): string | undefined {
  const query = parse(window.location.hash);
  const val = query[prop];
  if (!val) {
    return undefined;
  }
  if (Array.isArray(val)) {
    throw `May only have one hash parameter for ${prop}. Found: ${val}`;
  }
  return val;
}
