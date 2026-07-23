import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { IAuthoredDocumentContent } from "../document/document-content-import-types";
import { StampModel } from "../../plugins/drawing/model/stamp";
import { ToolbarButtonModel } from "../tiles/toolbar-button";
import { SettingsMstType } from "./settings";

// Probably this should be changed to something more complex
export const ToolbarModel = types.array(ToolbarButtonModel);
export interface IToolbarModel extends Instance<typeof ToolbarModel> {}
export type IToolbarModelSnapshot = SnapshotIn<typeof ToolbarModel>;

export interface ProblemConfiguration {
  disabledFeatures: string[];
  toolbar: SnapshotIn<typeof ToolbarModel>;
  authorTools: SnapshotIn<typeof ToolbarModel>;
  myResourcesToolbar: SnapshotIn<typeof ToolbarModel>;
  // required tile types that aren't in the toolbar can be specified here
  tools?: string[]; // legacy use of `tools` preserved to avoid content changes
  defaultDocumentTemplate?: IAuthoredDocumentContent;
  // Non-destructive switch for defaultDocumentTemplate: undefined (legacy) or true → apply the
  // template; false → skip it while preserving the authored content. Mirrors `aiEvaluation`/`aiPrompt`.
  defaultDocumentTemplateEnabled?: boolean;
  planningTemplate?: Record<string, IAuthoredDocumentContent>;
  planningTemplateEnabled?: boolean;
  // text shown in "placeholder" tiles.
  // key is the container type, value is the text.
  // currently supported container types are "QuestionContent" for placeholder tiles inside Question tiles,
  // and "default" for placeholder tiles in other contexts.
  // Note that the "placeholder" property of sections will override the default placeholder text.
  placeholder?: Record<string, string>;
  // This is the placeholder content shown in Text tiles.
  placeholderText: string;
  stamps: SnapshotIn<typeof StampModel>[];
  settings: SnapshotIn<typeof SettingsMstType>;
  // default panel layout when user first visits a problem
  // "split" (default) shows both panels; "workspace-only" collapses resources; "resources-only" collapses workspace
  defaultPanelLayout?: "split" | "workspace-only" | "resources-only";
  // how the resources and workspace panes divide the split view. "50-50" (default) splits evenly.
  // "wideContent" narrows the resources pane to its comments-open width (~1/3) when both panes are shown
  // and comments are closed, giving the workspace ~2/3; opening comments expands it back to the even split.
  contentLayout?: "50-50" | "wideContent";
}
