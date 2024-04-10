import { types, Instance } from "mobx-state-tree";
import { SharedModel } from "../../../models/shared/shared-model";

export const kSharedProgramDataType = "SharedProgramData";

const SharedProgramNode = types.model("SharedProgramNode", {
  nodeDisplayedName: types.string,
  nodeValue: types.map(types.maybe(types.number)),
  nodeType: types.string,
  nodeState: types.map(types.maybe(types.string)),
});

export const SharedProgramData = SharedModel.named("SharedProgramData")
.props({
  type: types.optional(types.literal(kSharedProgramDataType), kSharedProgramDataType),
  programNodes: types.map(SharedProgramNode)
})
.actions(self => ({
  setProgramNodes(newNodes: Map<string, Instance<typeof SharedProgramNode>>) {
    self.programNodes.clear();
    self.programNodes.merge(newNodes);
  },
  clearProgramNodes() {
    self.programNodes.clear();
  }
}))
.views(self => ({
  get allSharedNodesData() {
    return Array.from(self.programNodes.values());
  }
}));
