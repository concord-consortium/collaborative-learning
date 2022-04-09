import { getSnapshot, types, Instance, destroy, flow, SnapshotIn } from "mobx-state-tree";
import { ITileExportOptions, IDefaultContentOptions } from "../../models/tools/tool-content-info";
import { ToolContentModel } from "../../models/tools/tool-types";
import { kDiagramToolID, kDiagramToolStateVersion } from "./diagram-types";
import { DQRoot, VariableType } from "@concord-consortium/diagram-view";
import { SharedVariables } from "../shared-variables/shared-variables";

export const DiagramContentModel = ToolContentModel
  .named("DiagramTool")
  .props({
    type: types.optional(types.literal(kDiagramToolID), kDiagramToolID),
    version: types.optional(types.literal(kDiagramToolStateVersion), kDiagramToolStateVersion),
    root: types.optional(DQRoot, getSnapshot(DQRoot.create())),
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

// The migrator sometimes modifies the diagram content model so that its create 
// method actually goes through the migrator. When that happens if the snapshot doesn't
// have a version the snapshot will be ignored.
// This weird migrator behavior is documented here: src/models/mst.test.ts
// So because of that this method should be used instead of directly calling create
export function createDiagramContent(snapshot?: SnapshotIn<typeof DiagramContentModel>) {
  return DiagramContentModel.create({
    version: kDiagramToolStateVersion,
    ...snapshot
  });
}

export function defaultDiagramContent(options?: IDefaultContentOptions) {
  return createDiagramContent({ root: getSnapshot(DQRoot.create()) });
}


