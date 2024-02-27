import { CmsConfig, CmsField } from "netlify-cms-core";
import { urlParams } from "../../src/utilities/url-params";

const typeField = {
  label: "Type",
  name: "type",
  widget: "string"
} as CmsField;

const tagField = {
  label: "Tag",
  name: "tag",
  widget: "select",
  options: ["hardcoded", "but-should-be-dynamic", "look-at-commentTags-key", "in-unit-json"]
} as CmsField;

const previewLinkField = {
  label: "Preview Link",
  name: "preview-link",
  required: false,
  widget: "preview-link"
} as CmsField;

const contentField = {
  label: "Content",
  name: "content",
  widget: "clue" as any
} as CmsField;


const basicFields: CmsField[] = [
  typeField,
  previewLinkField,
  contentField
];

const exemplarFields: CmsField[] = [
  tagField,
  contentField
];

const legacyCurriculumSections = {
  name: "sections",
  label: "Curriculum Sections",
  label_singular: "Curriculum Section",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}` : `curriculum`,
  nested: { depth: 6 },
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

function hasSectionsFolder(myJson: any) {
  // TODO: figure out types for these parameters
  // None of the below were accepted, (even though they appear correct) so I must be misunderstanding something:
  // InvestigationModelType, ModernInvestigationSnapshot, LegacyInvestigationSnapshot
  // ProblemModelType, LegacyProblemSnapshot, ModernProblemSnapshot
  // SectionModelType, SectionModelSnapshot
  const unitProblems = myJson.investigations.map((inv: any) => inv.problems).flat();
  const allSections = unitProblems.map((prob: any ) => prob.sections).flat();
  const sectionStrInPath = allSections.some((section: any) => section.sectionPath.includes("sections/"));
  return sectionStrInPath;
}

export function getCmsCollections(unitJson: any): CmsConfig["collections"] {
  if (unitJson && hasSectionsFolder(unitJson)) {
    return [
      teacherGuides,     // HEY: make these functions that accept unitJson, that way you can get commentTags in (and make it more DRY, too)
      curriculumSections,
      exemplars
    ] as CmsConfig["collections"];
  } else {
    return [
      legacyCurriculumSections
    ] as CmsConfig["collections"];
  }
}
