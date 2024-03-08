import { parse } from "query-string";

/**
 * This is related to [url-params.ts](../../src/utilities/url-params.ts).
 * It is a subset of the parameters in that module so the CMS doesn't need to import
 * all of the dependencies used by `url-params.ts`
 */
export interface QueryParams {
  // string, e.g. "sas" for Stretching and Shrinking or "msa" for Moving Straight Ahead
  unit?: string;

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
}

export const processUrlParams = (): QueryParams => {
  const params = parse(location.search);
  return {
    ...params,
    // allows use of localCMSBackend without a value
    localCMSBackend: (params.localCMSBackend !== undefined),
  };
};

export const urlParams = processUrlParams();
