import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { StampModel } from "../tools/drawing/stamp";
import { ToolButtonModel } from "../tools/tool-button";
import { SettingsMstType } from "./settings";

// Probably this should be changed to something more complex
export const ToolbarModel = types.array(ToolButtonModel);
export interface ToolbarModelType extends Instance<typeof ToolbarModel> {}
export type ToolbarModelSnapshot = SnapshotIn<typeof ToolbarModel>;

export interface ProblemConfiguration {
  disabledFeatures: string[];
  toolbar: SnapshotIn<typeof ToolbarModel>;
  placeholderText: string;
  stamps: SnapshotIn<typeof StampModel>[];
  settings: SnapshotIn<typeof SettingsMstType>;
}
