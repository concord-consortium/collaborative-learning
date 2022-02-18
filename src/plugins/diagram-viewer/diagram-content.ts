import { FlowTransform } from "react-flow-renderer";
import { getSnapshot, types, Instance } from "mobx-state-tree";
import { ITileExportOptions, IDefaultContentOptions } from "../../models/tools/tool-content-info";
import { ToolContentModel } from "../../models/tools/tool-types";
import { kDiagramToolID } from "./diagram-types";
import { DQRoot } from "./src/models/dq-root";

// This is only used directly by tests
export function defaultDiagramContent(options?: IDefaultContentOptions) {
  return DiagramContentModel.create({ root: getSnapshot(DQRoot.create()) });
}

export const DiagramContentModel = ToolContentModel
  .named("DiagramTool")
  .props({
    type: types.optional(types.literal(kDiagramToolID), kDiagramToolID),
    root: types.optional(DQRoot, getSnapshot(DQRoot.create())),
    transform: types.maybe(types.frozen<FlowTransform>())
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
  }));

export interface DiagramContentModelType extends Instance<typeof DiagramContentModel> {}
