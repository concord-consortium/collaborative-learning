import { Instance, types } from "mobx-state-tree";

export const ToolMetadataModel = types.model("ToolMetadataModel", {
    // id of associated tile
    id: types.string,
  });
export interface ToolMetadataModelType extends Instance<typeof ToolMetadataModel> {}
