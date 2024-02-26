import { CmsConfig, CmsField } from "netlify-cms-core";
import { urlParams } from "../../src/utilities/url-params";
import { AppConfigModel, AppConfigModelSnapshot } from "../../src/models/stores/app-config-model";
import appConfigJson from "../../src/clue/app-config.json";
import { getUnitJson } from "../../src/models/curriculum/unit";

const appConfig = AppConfigModel.create(appConfigJson as AppConfigModelSnapshot);
const unit = urlParams.unit ?? "sas";

// 0 predefined content types
const curriculumSections = {
  name: "sections",
  label: "Curriculum Sections",
  label_singular: "Curriculum Section",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}` : `curriculum`,
  nested: {
    depth: 6,
  },
  fields: [
    {
      label: "Type",
      name: "type",
      widget: "string"
    },
    {
      label: "Preview Link",
      name: "preview-link",
      required: false,
      widget: "preview-link"
    } as CmsField,
    {
      label: "Content",
      name: "content",
      widget: "clue" as any
    }
  ],
};

const teacherGuides = {
  name: "teacherGuides",
  label: "Teacher Guides",
  label_singular: "Teacher Guide",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}/teacher-guide` : `curriculum/teacher-guide`,
  nested: {
    depth: 6,
  },
  fields: [
    {
      label: "Type",
      name: "type",
      widget: "string"
    },
    {
      label: "Preview Link",
      name: "preview-link",
      required: false,
      widget: "preview-link"
    } as CmsField,
    {
      label: "Content",
      name: "content",
      widget: "clue" as any
    }
  ],
};

// 1 before we will ask for config we need to have gotten unit json
let unitJson: any;
getUnitJson(unit, appConfig).then((json) => {
  unitJson = json;
  if (!unitJson.code) return;
  getCmsCollections();
});


export function getCmsCollections(): CmsConfig["collections"] {
  return [
    teacherGuides,
    curriculumSections
  ] as CmsConfig["collections"];
  // TODO: code commented out below does not raise errors, but
  // because of async-ness the default configuration is returned the first time
  // and that seems to set the configuration for the rest of the session
  if (unitJson && unitJson.code === "moth") {
    console.log("| Returning new configuration");
    return [teacherGuides] as CmsConfig["collections"];
  } else {
    console.log("| Returning default configuration");
    return [curriculumSections] as CmsConfig["collections"];
  }
}
