import { getType, Instance, types } from "mobx-state-tree";
import { DataSet, IDataSet } from "../data/data-set";
import { SharedModel, SharedModelType } from "./shared-model";

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
}))
.actions(self => ({
  setDataSet(data: IDataSet) {
    self.dataSet = data;
  }
}));
export interface SharedDataSetType extends Instance<typeof SharedDataSet> {}

export function isSharedDataSet(model?: SharedModelType): model is SharedDataSetType {
  return model ? getType(model) === SharedDataSet : false;
}
