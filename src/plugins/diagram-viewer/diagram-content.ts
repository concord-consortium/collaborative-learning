import { FlowTransform } from "react-flow-renderer";
import { getSnapshot, types, Instance, destroy, flow } from "mobx-state-tree";
import { ITileExportOptions, IDefaultContentOptions } from "../../models/tools/tool-content-info";
import { ToolContentModel } from "../../models/tools/tool-types";
import { kDiagramToolID } from "./diagram-types";
import { DQRoot, VariableType } from "@concord-consortium/diagram-view";
import { SharedVariables } from "../shared-variables/shared-variables";

// This is only used directly by tests
export function defaultDiagramContent(options?: IDefaultContentOptions) {
  return DiagramContentModel.create({ root: getSnapshot(DQRoot.create()) });
}

export const DiagramContentModel = ToolContentModel
  .named("DiagramTool")
  .props({
    type: types.optional(types.literal(kDiagramToolID), kDiagramToolID),
    root: types.optional(DQRoot, getSnapshot(DQRoot.create())),
    transform: types.maybe(types.frozen<FlowTransform>()),
    sharedModel: types.maybe(SharedVariables)
  })
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      // crude, but enough to get us started
      return JSON.stringify(getSnapshot(self.root));
    }
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    }
  }))
  .actions(self => ({
    setTransform(transform: FlowTransform) {
      self.transform = transform;
    }
  }))
  .actions(self => {
    // This action is needed because the tree monitor and update code isn't in place
    // yet.
    const removeVariable = flow(function* removeVariable(variable?: VariableType) {
      if (variable) {
        const node = self.root.getNodeFromVariableId(variable.id);
  
        destroy(variable);
  
        // In order to emulate more of what will happen with the tree monitor
        // this small delay is added.
        yield new Promise((resolve) => {
          setTimeout(resolve, 1);
        });
  
        destroy(node);
      }
    });

    return {removeVariable};
  })
  .actions(self => ({
    afterAttach() {
      if (!self.sharedModel) {
        self.sharedModel = SharedVariables.create();
      }

      // When the tree monitor code is in place we can just set the sharedModel 
      // as the variablesAPI. And the updating of the node when a variable is deleted
      // will be handled by an update function. 
      // In the meantime we emulate this effect with an async removeVariable implementation
      self.root.setVariablesAPI({
        createVariable(): VariableType {
          if (!self.sharedModel) {
            throw new Error("Need a sharedModel to create variables");
          }
          return self.sharedModel.createVariable();
        },
        removeVariable(variable?: VariableType): void {
          self.removeVariable(variable);
        }
      });
    }
  }));

export interface DiagramContentModelType extends Instance<typeof DiagramContentModel> {}
