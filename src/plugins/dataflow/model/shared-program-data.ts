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
  // NEXT: newNodes might not be of type Map<string, Instance<typeof SharedProgramNode>>
  // so type it for what you are currently passing
  // and then set the data
  // then make a view that the SIM can use and access the model from the sim and pass it on througth
  setProgramNodes(newNodes: Map<string, Instance<typeof SharedProgramNode>>) {
    self.programNodes.clear();
    console.log("| setProgramNodes | to  newNodes: ", typeof newNodes, newNodes);
    //newNodes && self.programNodes.merge(newNodes);
  }
}))
.views(self => ({
  get allSharedNodesData() {
    return Array.from(self.programNodes.values());
  }
}));

export interface SharedProgramDataType extends Instance<typeof SharedProgramData> {}

