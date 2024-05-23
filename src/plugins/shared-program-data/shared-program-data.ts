import { types, Instance } from "mobx-state-tree";
import { SharedModel } from "../../models/shared/shared-model";
import { observable } from "mobx";

export const kSharedProgramDataType = "SharedProgramData";

export const kSharedNodeKeys = [
  "sensor",
  "sensorType",
  "generatorType",
  "mathOperator",
  "logicOperator",
  "transformOperator",
  "controlOperator",
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
  "Live Output": "output",
  "Timer": "input"
};

export interface ISharedProgramNode {
  id: string;
  nodeDisplayedName: string;
  nodeValue: string;
  nodeType: string;
  nodeState: Record<string, string>;
  nodeCategory: string;
}

export const SharedProgramData = SharedModel.named("SharedProgramData")
.props({
  type: types.optional(types.literal(kSharedProgramDataType), kSharedProgramDataType)
})
.volatile(self => ({
  samplingRate: 0,
  samplingRateStr: " ",
  programNodes: observable.map() as Map<string, ISharedProgramNode>
}))
.actions(self => ({
  setProgramNodes(newNodes: ISharedProgramNode[]) {
    const newNodeIds = Array.from(newNodes, n => n.id);
    // Remove any nodes not in the new list
    for (const id of self.programNodes.keys()) {
      if (!newNodeIds.includes(id)) {
        self.programNodes.delete(id);
      }
    }

    // Add new, and update existing, nodes
    newNodes.forEach(node => {
      if (!node.id) return;
      self.programNodes.set(node.id, node);
    });
  },
  setProgramSamplingRateStr(rate: string) {
    self.samplingRateStr = rate;
  },
  setProgramSamplingRate(rate: number) {
    self.samplingRate = rate;
  }
}));

export interface SharedProgramDataType extends Instance<typeof SharedProgramData> {}

