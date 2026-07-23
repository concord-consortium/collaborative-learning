import { EAuthorableNavTab } from "../models/view/nav-tabs";
import { DocFilterType, SortTypeIds, type SortTypeId } from "../models/stores/ui-types";
export { SortTypeIds, SortTypeId };

export interface ISortWorkConfig {
  defaultPrimarySort?: SortTypeId;
  docFilterOptions?: DocFilterType[];
  showContextFilter?: boolean;
  sortOptions?: SortTypeId[];
}

export const aiEvaluations = ["categorize-design", "custom"] as const;
export type AIEvaluation = typeof aiEvaluations[number];

export const summarizers = ["text", "image"] as const;
export type Summarizer = typeof summarizers[number];

export const commentRoles = ["student", "teacher", "researcher"] as const;
export type CommentRole = typeof commentRoles[number];

export type IUnitFiles = Record<string, IUnitFile>;
export interface IUnitFile {
  sha: string;
  type?: string;
  title?: string;
}
export interface IUnit {
  code: string;
  abbrevTitle: string;
  title: string;
  subtitle: string;
  config: IUnitConfig;
  sections: Record<string, ISection>;
  planningDocument: IPlanningDocument;
  investigations: IInvestigation[];
}

export interface IUnitConfig extends IItemTemplateConfig {
  enableHistoryRoles: string[];
  disablePublish: boolean;
  placeholderText: string;
  toolbar: IToolbarItem[];
  navTabs: INavTabs;
  stamps: IStamp[];
  settings: ISettings;
  showCommentTag: boolean;
  showCommentRating: boolean;
  commentTags: Record<string, string>;
  allowCustomCommentTags?: boolean;
  enableCommentRoles: CommentRole[];
  aiEvaluation?: AIEvaluation;
  aiPrompt: IAiPrompt;
  chatTutorPrompts?: IChatTutorPrompts;
  authorTools?: IAuthorTool[];
  showIdeasButton?: boolean;
  hide4up?: boolean;
  sortWorkConfig?: ISortWorkConfig;
  termOverrides?: Record<string, string>;
  defaultPanelLayout?: "split" | "workspace-only" | "resources-only";
  // "50-50" (default) splits the panes evenly; "wideContent" narrows the resources pane to its
  // comments-open width so the workspace gets ~2/3 until comments are opened.
  contentLayout?: "50-50" | "wideContent";
  defaultSharedDocuments?: boolean;
}

export interface IAuthorTool {
  id: string;
  title: string;
  isTileTool: boolean;
  iconId?: string;
}

export interface IToolbarItem {
  id: string;
  title: string;
  iconId?: string;
  isTileTool?: boolean;
  isDefault?: boolean;
}

export interface INavTabs {
  lazyLoadTabContents: boolean;
  showNavPanel: boolean;
  tabSpecs: INavTabSpec[];
}

export type AuthorableNavTab = `${EAuthorableNavTab}`;

export interface INavTabSpec {
  tab: AuthorableNavTab;
  label: string;
  teacherOnly?: boolean;
  sections?: INavTabSection[];
  hidden?: boolean;
}

export interface INavTabSection {
  initials?: string;
  title: string;
  type: string;
  dataTestHeader?: string;
  dataTestItem?: string;
  documentTypes?: string[];
  order?: string;
  showStars?: string[];
  properties?: string[];
  addDocument?: boolean;
}

export interface IStamp {
  url: string;
  width: number;
  height: number;
}

export interface ISettings {
  // `hideTitle` is a generic per-tile setting (undefined -> title shown).
  text?: {
    hideTitle?: boolean;
  };
  table: {
    numFormat: string;
    tools: (string | [string, string])[];
  };
  graph: {
    tools: string[];
    defaultAxisLabels: Record<string, string>;
    emptyPlotIsNumeric: boolean;
    scalePlotOnValueChange: boolean;
    defaultSeriesLegend: boolean;
    connectPointsByDefault: boolean;
  };
}

export interface IAiPrompt {
  systemPrompt: string;
  mainPrompt: string;
  categorizationDescription: string;
  categories: string[];
  keyIndicatorsPrompt: string;
  discussionPrompt: string;
  summarizer?: Summarizer;
}

// Optional per-unit overrides of the AI chat tutor's server-side generic prompt.
export interface IChatTutorPrompts {
  replaceGenericPrompt?: string;
  appendToGenericPrompt?: string;
}

export interface ISection {
  initials: string;
  title: string;
  placeholder: string;
}

export interface IPlanningDocument {
  enable: string;
  default: boolean;
  sectionInfo: Record<string, ISection>;
  sections: { type: string }[];
}

export interface IInvestigation {
  description: string;
  ordinal: number;
  title: string;
  introduction?: { tiles?: ITile[] };
  problems: IProblem[];
}

export interface IProblem {
  description: string;
  ordinal: number;
  title: string;
  subtitle: string;
  sections: string[];
  config?: IItemTemplateConfig;
  disabled?: any[];
}

// A section-divider marker in an authored template: a row with no tile, carrying the section flag
// on its content. Mirrors the runtime authored format { content: { isSectionHeader, sectionId } }.
export interface ISectionDividerTile {
  content: { isSectionHeader: true; sectionId: string };
}

// A "put content here" placeholder for an empty section, mirroring the placeholder tile the default
// sectioned problem document uses (createDefaultSectionedContent). Removed at runtime once content is added.
export interface IPlaceholderTile {
  content: { type: "Placeholder"; sectionId: string; containerType: string };
}

// A tile in a template is a normal authored tile, a section divider, or a section placeholder.
export type ITemplateTile = ITile | ISectionDividerTile | IPlaceholderTile;

// Preloaded document content ({ tiles }) copied into a new document on first creation.
// Same authored shape as section content. See IAuthoredDocumentContent in the runtime.
export interface ITemplateContent {
  tiles: ITemplateTile[];
}

// Template-related config shared by the unit and by each problem/teacher-guide problem.
// The `*Enabled` flags switch a template on/off WITHOUT deleting its content (mirrors how
// `aiEvaluation` gates the persistent `aiPrompt`); content is only removed by an explicit delete.
// planningTemplate is keyed by planning section type (defined per-unit), so a generic map matches
// the authored JSON and the section-agnostic editor better than a fixed set of keys.
export interface IItemTemplateConfig {
  defaultDocumentTemplate?: ITemplateContent;
  defaultDocumentTemplateEnabled?: boolean;
  planningTemplate?: Record<string, ITemplateContent>;
  planningTemplateEnabled?: boolean;
}

export interface ITile {
  id: string;
  title: string;
  content: ITileContent;
}

export interface ITileContent {
  type: string;
  format?: string;
  text?: string[];
}
