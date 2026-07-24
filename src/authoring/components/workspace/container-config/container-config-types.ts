export interface UnitChild {
  title: string;
  originalIndex?: number;
}

// Represents a section in the problem form
export interface ProblemSectionFormItem {
  // The section type key (e.g., "introduction", "whatIf")
  type: string;
  // Whether this section is enabled for this problem
  enabled: boolean;
  // The file path if it exists (from problem.sections array)
  existingPath?: string;
}

// Form inputs for problem configuration
export interface IProblemFormInputs {
  title: string;
  sections: ProblemSectionFormItem[];
  // Template enable flags persist with the form (on Save), like the unit-scope Document Settings form.
  documentTemplateEnabled: boolean;
  planningTemplateEnabled: boolean;
}

export interface IUnitParentFormInputs {
  title: string;
  description?: string;
  // This is used at the unit and investigation level
  firstOrdinal?: number;
  children: UnitChild[];
}
