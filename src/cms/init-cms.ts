(window as any).CMS_MANUAL_INIT = true;

import CMS from "netlify-cms-app";
import { CmsConfig } from "netlify-cms-core";
import { urlParams } from "../utilities/url-params";

import { JsonControl } from "./json-control";

// Test URL:
// http://localhost:8080/admin.html?contentBranch=author&unit=sas#/collections/sections

// Config or Decap CMS
const cmsConfig: CmsConfig = {
  load_config_file: false,
  backend: {
    name: "github",
    repo: "concord-consortium/clue-curriculum",
    branch: urlParams.contentBranch || "author", // Branch to update (optional; defaults to master)
    base_url: "https://us-central1-cms-github-auth.cloudfunctions.net",
    auth_endpoint: "/oauth/auth"
  },
  // local_backend: true,
  media_folder: urlParams.unit ? `curriculum/${urlParams.unit}/images` : `curriculum/images`,
  // public_folder: urlParams.unit ? `/${urlParams.unit}/images` : `curriculum/images`,
  public_folder: `${urlParams.unit}/images`,
  collections: [
    {
      name: "sections",
      label: "Curriculum Sections",
      label_singular: "Curriculum Section",
      identifier_field: "type",
      format: "json",
      folder: urlParams.unit ? `curriculum/${urlParams.unit}` : `curriculum`,
      public_folder: `${urlParams.unit}/images`,
      // create: true
      // adding a nested object will show the collection folder structure
      nested: {
        depth: 6, // max depth to show in the collection tree
        // summary: "{{title}}" // optional summary for a tree node, defaults to the inferred title field
      },
      fields: [
        {
          label: "Type",
          name: "type",
          widget: "string"
        },
        {
          label: "Content",
          name: "content",
          widget: "json" as any
        }
      ],
      // adding a meta object with a path property allows editing the path of entries
      // moving an existing entry will move the entire sub tree of the entry to the new location
      meta: { path: { widget: "hidden", label: "Path", index_file: "content" } }
    }
  ]
};
// (window as any).CMS_CONFIG = cmsConfig;

export function initCMS() {
  CMS.registerWidget("json", JsonControl);
  CMS.init({config: cmsConfig});
}
