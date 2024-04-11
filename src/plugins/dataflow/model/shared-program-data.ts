import { types, Instance } from "mobx-state-tree";
import { SharedModel } from "../../../models/shared/shared-model";
import { IBaseNode } from "../nodes/base-node";
import { observable } from "mobx";

export const kSharedProgramDataType = "SharedProgramData";

export const kSharedNodeKeys = [
  "sensor",
  "sensorType",
  "generatorType",
  "mathOperator",
  "logicOperator",
  "transformOperator",
  "outputType", // for demo output node
  "hubSelect",
  "liveOutputType" // for live output node
];

// REVIEW: project spec doesn't specify all of these
// Current values are as close to "reality" as possible*
export const kSharedNodeCategories = [
  {
    category: "input",
    nodeTypes: [
      "Sensor",
    ]
  },
  {
    category: "operator",
    nodeTypes: [
      "Generator",
      "Number",
      "Math",
      "Logic",
      "Transform",
      "Demo Output", // *stays "in the chip" (not out to pin)
    ]
  },
  {
    category: "output",
    nodeTypes: [
      "Live Output"
    ]
  }
];

export interface ISharedProgramNode {
  id: string;
  nodeDisplayedName: string;
  nodeValue: number;
  nodeType: string;
  nodeState: Record<string, string | number>;
}

export const SharedProgramData = SharedModel.named("SharedProgramData")
.props({
  type: types.optional(types.literal(kSharedProgramDataType), kSharedProgramDataType)
})
.volatile(self => ({
  programNodes: observable.map() as Map<string, ISharedProgramNode>
}))
.actions(self => ({
  setProgramNodes(newNodes: IBaseNode[]) {
    self.programNodes.clear();

    newNodes.forEach(node => {
      const nodeStateData = {};
      Object.keys(node.model).forEach(key => {
        if (kSharedNodeKeys.includes(key)) {
          (nodeStateData as any)[key] = (node.model as any)[key];
        }
      });
      const newNode = {
        id: node.id,
        nodeDisplayedName: node.model.orderedDisplayName || "",
        nodeValue: node.model.nodeValue || 0,
        nodeType: node.model.type,
        nodeState: nodeStateData
        // TODO: add the category
      };
      if (!newNode.id) return;
      // REVIEW: ended up needing to make this whole thing an array
      // was unable to put into the map, despite having an id, and simpifying the object
      try {
        self.programNodes.set(newNode.id, newNode);
      } catch (error) {
        console.error('Error putting node into programNodes:', error);
      }
    });
   console.log("| just set program nodes: hmm? ", self.programNodes);
  }
}))
.views(self => ({
  get allSharedNodesData() {
    return Array.from(self.programNodes.values());
  }
}));

export interface SharedProgramDataType extends Instance<typeof SharedProgramData> {}

