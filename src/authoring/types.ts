import { EAuthorableNavTab } from "../models/view/nav-tabs";

export type IUnitFiles = Record<string, IUnitFile>;
export interface IUnitFile {
  sha: string;
  type?: string;
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

export interface IUnitConfig {
  enableHistoryRoles: string[];
  disablePublish: boolean;
  placeholderText: string;
  toolbar: IToolbarItem[];
  navTabs: INavTabs;
  stamps: IStamp[];
  settings: ISettings;
  showCommentTag: boolean;
  commentTags: Record<string, string>;
  tagPrompt: string;
  enableCommentRoles: string[];
  aiEvaluation: string;
  aiPrompt: IAiPrompt;
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
  config?: {
    planningTemplate: IPlanningTemplate;
  };
  disabled?: any[];
}

export interface IPlanningTemplate {
  overview?: { tiles: ITile[] };
  launch?: { tiles: ITile[] };
  explore?: { tiles: ITile[] };
  summarize?: { tiles: ITile[] };
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
