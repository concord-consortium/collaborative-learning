import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { IAuthoredDocumentContent } from "../document/document-content-import-types";
import { StampModel } from "../../plugins/drawing/model/stamp";
import { ToolbarButtonModel } from "../tiles/toolbar-button";
import { SettingsMstType } from "./settings";
import { ENavTab } from "../view/nav-tabs";

// Probably this should be changed to something more complex
export const ToolbarModel = types.array(ToolbarButtonModel);
export interface IToolbarModel extends Instance<typeof ToolbarModel> {}
export type IToolbarModelSnapshot = SnapshotIn<typeof ToolbarModel>;

// The panel-layout options an author can set; shared so persist-ui and the authoring form don't respell it.
export type PanelLayout = "split" | "workspace-only" | "resources-only";

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
  defaultPanelLayout?: PanelLayout;
  // how the resources and workspace panes divide the split view. "evenLayout" (default) splits evenly.
  // "wideContent" narrows the resources pane to its comments-open width (~1/3) when both panes are shown
  // and comments are closed, giving the workspace ~2/3; opening comments expands it back to the even split.
  contentLayout?: "evenLayout" | "wideContent";
  // When true, every load starts on `fixedStartTab` (no open document, divider reset to the unit
  // default) instead of restoring the user's last-seen state. Off/undefined = restore last state.
  // The forced view is applied as a session-only override, so it never overwrites the saved state.
  fixedStartView?: boolean;
  // The nav tab to start on when fixedStartView is true. ENavTab constrains our own call sites and
  // fixtures; hand-authored unit JSON is loaded as types.frozen, so a typo there is not rejected at
  // load time and only shows up as resolveStartView's console warning. Kept as a separate value so
  // toggling the switch off preserves the author's choice.
  fixedStartTab?: ENavTab;
}
