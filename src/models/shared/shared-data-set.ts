import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { DataSet } from "../data/data-set";
import { SharedModel } from "./shared-model";

export const kSharedDataSetType = "SharedDataSet";

export const SharedDataSet = SharedModel
.named("SharedDataSet")
.props({
  type: types.optional(types.literal(kSharedDataSetType), kSharedDataSetType),
  providerId: "",
  dataSet: DataSet
})
.views(self => ({
  get xLabel() {
    return self.dataSet.attributes[0]?.name;
  },
  get yLabel() {
    return self.dataSet.attributes[1]?.name;
  },
}));
export interface SharedDataSetType extends Instance<typeof SharedDataSet> {}
export interface SharedDataSetSnapshotType extends SnapshotIn<typeof SharedDataSet> {}
