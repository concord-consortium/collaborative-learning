import { CmsConfig, CmsField } from "netlify-cms-core";
import { urlParams } from "../../src/utilities/url-params";

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


const exemplarFields = [
  {
    label: "Tag",
    name: "tag",
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
  fields: exemplarFields
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
