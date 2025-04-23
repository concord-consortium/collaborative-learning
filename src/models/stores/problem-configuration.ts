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
  planningTemplate?: Record<string, IAuthoredDocumentContent>;
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
}
