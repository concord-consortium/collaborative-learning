import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { ToolButtonModel } from "../tools/tool-button";

// Probably this should be changed to something more complex
export const ToolbarModel = types.array(ToolButtonModel);
export interface ToolbarModelType extends Instance<typeof ToolbarModel> {}
export type ToolbarModelSnapshot = SnapshotIn<typeof ToolbarModel>;
