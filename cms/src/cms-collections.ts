import { CmsCollection, CmsConfig, CmsField } from "decap-cms-core";
import { urlParams } from "./cms-url-params";

const typeField: CmsField = {
  label: "Type",
  name: "type",
  widget: "string"
};

const titleField: CmsField = {
  label: "Title",
  name: "title",
  widget: "string"
};

const tagField: Extract<CmsField, {widget: "select"}> = {
  label: "Tag",
  name: "tag",
  widget: "select",
  options: []
};

const previewLinkField: CmsField = {
  label: "Preview Link",
  name: "preview-link",
  required: false,
  widget: "preview-link" as any
};

const contentField: CmsField = {
  label: "Content",
  name: "content",
  widget: "clue" as any
};

const legacyCurriculumSections: CmsCollection = {
  name: "sections",
  label: "Curriculum Sections",
  label_singular: "Curriculum Section",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}` : `not-supported`,
  nested: { depth: 6 },
  fields: [typeField, previewLinkField, contentField]
};

const curriculumSections: CmsCollection = {
  name: "sections",
  label: "Curriculum Sections",
  label_singular: "Curriculum Section",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}/sections` : `not-supported`,
  nested: { depth: 6 },
  fields: [typeField, previewLinkField, contentField]
};

const teacherGuides: CmsCollection = {
  name: "teacherGuides",
  label: "Teacher Guides",
  label_singular: "Teacher Guide",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}/teacher-guide/sections` : `not-supported`,
  nested: { depth: 6 },
  fields: [typeField, previewLinkField, contentField]
};

const exemplars: CmsCollection = {
  name: "exemplars",
  label: "Exemplars",
  label_singular: "Exemplar",
  identifier_field: "type",
  format: "json",
  folder: urlParams.unit ? `curriculum/${urlParams.unit}/exemplars` : `not-supported`,
  nested: { depth: 6 },
  fields: [titleField, tagField, contentField]
};

function hasSectionsFolder(myJson: any) {
  // TODO: use ModernUnitSnapshot | LegacyUnitSnapshot
  // (some issue with importing them from the models file, so we use any for now)
  const unitProblems = myJson.investigations?.map((inv: any) => inv.problems).flat();
  const allSections = unitProblems?.map((prob: any ) => prob.sections).flat();
  const sectionStrInPath = allSections?.some((section: any) => section.includes("sections/"));
  return sectionStrInPath;
}

export function getCmsCollections(unitJson: any): CmsConfig["collections"] {
  if (unitJson?.config?.commentTags) {
    const tags: Record<string, string> = unitJson.config.commentTags;
    const options = Object.entries(tags).map(([value, label]) => ({ label, value }));
    tagField.options = options;
  }

  if (unitJson && hasSectionsFolder(unitJson)) {
    return [
      teacherGuides,
      curriculumSections,
      exemplars
    ];
  } else {
    return [
      legacyCurriculumSections
    ];
  }
}
