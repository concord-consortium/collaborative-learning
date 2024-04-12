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

export const kNodeTypeToCategoryMap: { [key: string]: string } = {
  "Sensor": "input",
  "Generator": "input",
  "Number": "input",
  "Math": "operator",
  "Logic": "operator",
  "Control": "operator",
  "Transform": "operator",
  "Demo Output": "output",
  "Live Output": "output"
};

export interface ISharedProgramNode {
  id: string;
  nodeDisplayedName: string;
  nodeValue: number;
  nodeType: string;
  nodeState: Record<string, string | number>;
  nodeCategory: string;
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
        nodeState: nodeStateData,
        nodeCategory: kNodeTypeToCategoryMap[node.model.type]
      };
      if (!newNode.id) return;
      try {
        self.programNodes.set(newNode.id, newNode);
      } catch (error) {
        console.error('Error putting node into programNodes:', error);
      }
    });
  }
}));

export interface SharedProgramDataType extends Instance<typeof SharedProgramData> {}

