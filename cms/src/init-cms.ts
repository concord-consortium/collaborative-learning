(window as any).CMS_MANUAL_INIT = true;

import CMS from "decap-cms-app";
import { CmsBackendType, CmsConfig } from "decap-cms-core";

import { urlParams } from "./cms-url-params";
import { IframeControl } from "./iframe-control";
import { JsonControl } from "./json-control";
import { PreviewLinkControl } from "./preview-link-control";
import { defaultCurriculumBranch } from "./cms-constants";
import { getCmsCollections } from "./cms-collections";
import { getUnitJson } from "../../src/models/curriculum/unit-utils";
import { CurriculumConfig } from "../../src/models/stores/curriculum-config";

import curriculumConfigJson from "../../src/clue/curriculum-config.json";

const curriculumConfig = CurriculumConfig.create(curriculumConfigJson, { urlParams });
const unit = urlParams.unit ?? curriculumConfig.defaultUnit;

// Local testing of the CMS without working with github directly:
// - Add the localCMSBacked parameter to the URL
// - start a proxy in a checkout of the clue-curriculum repository with:
//     cd ../clue-curriculum; npx netlify-cms-proxy-server
function cmsBackend() {
  if (urlParams.localCMSBackend) {
    return {
      backend: {
        name: "git-gateway" as CmsBackendType
      },
      local_backend: true,
    };
  } else {
    return {
      backend: {
        name: "github" as CmsBackendType,
        repo: "concord-consortium/clue-curriculum",
        branch: urlParams.curriculumBranch || defaultCurriculumBranch,
        base_url: "https://us-central1-cms-github-auth.cloudfunctions.net",
        auth_endpoint: "/oauth/auth"
      }
    };
  }
}

// Config for Decap CMS
function cmsConfig(unitJson: any): CmsConfig {
  return {
    load_config_file: false,
    ...cmsBackend(),
    media_folder: urlParams.unit ? `curriculum/${urlParams.unit}/images` : `curriculum/images`,
    // The public_folder setting doesn't apply to the top level "Media" dialog.
    // It is configured here for documentation, and in case we start using
    // the media api within out CLUE editor
    public_folder: urlParams.unit ? `${urlParams.unit}/images` : `images`,
    collections: getCmsCollections(unitJson)
  };
}

export async function initCMS() {
  CMS.registerWidget("clue", IframeControl);
  CMS.registerWidget("json", JsonControl);
  CMS.registerWidget("preview-link", PreviewLinkControl);
  const unitJson = await getUnitJson(unit, curriculumConfig);
  CMS.init({config: cmsConfig(unitJson)});
}


