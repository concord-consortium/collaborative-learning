import { CmsConfig, CmsField } from "netlify-cms-core";
import { urlParams } from "../../src/utilities/url-params";
import { AppConfigModel, AppConfigModelSnapshot } from "../../src/models/stores/app-config-model";
import appConfigJson from "../../src/clue/app-config.json";
import { defaultCurriculumUnit } from "./cms-constants";

const appConfig = AppConfigModel.create(appConfigJson as AppConfigModelSnapshot);
const unit = urlParams.unit ?? defaultCurriculumUnit;

// 0 predefined content types

const basicFields = [
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
] as CmsField[];

const legacyCurriculumSections = {
  name: "sections",
  label: "Curriculum Sections",
  label_singular: "Curriculum Section",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}` : `curriculum`,
  nested: {
    depth: 6,
  },
  fields: basicFields
};

const curriculumSections = {
  name: "sections",
  label: "Curriculum Sections",
  label_singular: "Curriculum Section",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}/sections` : `curriculum/sections`,
  nested: { depth: 6 },
  fields: basicFields
};

const teacherGuides = {
  name: "teacherGuides",
  label: "Teacher Guides",
  label_singular: "Teacher Guide",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}/teacher-guide` : `curriculum/teacher-guide`,
  nested: { depth: 6 },
  fields: basicFields
};

const exemplars = {
  name: "exemplars",
  label: "Exemplars",
  label_singular: "Exemplar",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}/exemplars` : `curriculum/exemplars`,
  nested: { depth: 6 },
  fields: basicFields
};

function isNewUnitType(myJson: any) {
  return myJson.code === "moth";
}

export function getCmsCollections(unitJson: any): CmsConfig["collections"] {
  if (unitJson && isNewUnitType(unitJson)) {
    return [
      teacherGuides,
      curriculumSections,
      exemplars
    ] as CmsConfig["collections"];
  } else {
    return [legacyCurriculumSections] as CmsConfig["collections"];
  }
}
