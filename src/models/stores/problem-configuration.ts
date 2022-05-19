import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { IAuthoredDocumentContent } from "../document/document-content-import";
import { StampModel } from "../../plugins/drawing-tool/model/stamp";
import { ToolButtonModel } from "../tools/tool-button";
import { SettingsMstType } from "./settings";

// Probably this should be changed to something more complex
export const ToolbarModel = types.array(ToolButtonModel);
export interface ToolbarModelType extends Instance<typeof ToolbarModel> {}
export type ToolbarModelSnapshot = SnapshotIn<typeof ToolbarModel>;

export interface ProblemConfiguration {
  disabledFeatures: string[];
  toolbar: SnapshotIn<typeof ToolbarModel>;
  // required tools that aren't in the toolbar can be specified here
  tools?: string[];
  defaultDocumentTemplate?: IAuthoredDocumentContent;
  placeholderText: string;
  stamps: SnapshotIn<typeof StampModel>[];
  settings: SnapshotIn<typeof SettingsMstType>;
}
