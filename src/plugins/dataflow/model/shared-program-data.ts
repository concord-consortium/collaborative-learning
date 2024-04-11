import { types, Instance } from "mobx-state-tree";
import { SharedModel } from "../../../models/shared/shared-model";
import { IBaseNode } from "../nodes/base-node";

export const kSharedProgramDataType = "SharedProgramData";

// export interface NodeSummary {
//   type: string;
//   nodeValue: number;
//   orderedDisplayName: string;
//   //plot: boolean; // not going to need this
//   //recentValues: number[];
//   [key: string]: any;
// }

const SharedProgramNode = types.model("SharedProgramNode", {
  nodeDisplayedName: types.string,
  nodeValue: types.number,
  nodeType: types.string,
  nodeState: types.map(types.maybe(types.string)),
});

export const SharedProgramData = SharedModel.named("SharedProgramData")
.props({
  type: types.optional(types.literal(kSharedProgramDataType), kSharedProgramDataType),
  programNodes: types.map(SharedProgramNode)
})
.actions(self => ({
  setProgramNodes(newNodes: IBaseNode[]) {
    self.programNodes.clear();
    // console.log("| setProgramNodes | to  newNodes: ", typeof newNodes, newNodes);
    // newNodes.forEach(node => {
    //   const { plot, recentValues, ...nodeWithoutUnwantedKeys } = node.model;
    //   self.programNodes.put(nodeWithoutUnwantedKeys);
    // });
    newNodes.forEach(node => {
      console.log("| make this node an entry in the SharedProgramNode map: ", node);
      // self.programNodes.put({
      //   nodeDisplayedName: node.orderedDisplayName,
      //   nodeValue: node.nodeValue,
      //   nodeType: node.type,
      //   //nodeState: node.nodeState
      // });
    });
  }
}))
.views(self => ({
  get allSharedNodesData() {
    return Array.from(self.programNodes.values());
  }
}));

export interface SharedProgramDataType extends Instance<typeof SharedProgramData> {}

