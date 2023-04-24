import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { cloneDeep } from "lodash";

import { DataSet, newCaseId } from "../data/data-set";
import { SharedModel } from "./shared-model";
import { uniqueId } from "../../utilities/js-utils";

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

export function isSharedDataSetSnapshot(snapshot: any): snapshot is SharedDataSetSnapshotType {
  return snapshot.type === kSharedDataSetType;
}

export interface UpdatedSharedDataSetIds {
  attributeIdMap: Record<string, string>;
  caseIdMap: Record<string, string>;
  dataSetId: string;
  sharedModelId: string;
}

export function getUpdatedSharedDataSetIds(sharedDataSet: SharedDataSetSnapshotType) {
  const updatedIds: UpdatedSharedDataSetIds = {
    attributeIdMap: {},
    caseIdMap: {},
    dataSetId: uniqueId(),
    sharedModelId: uniqueId()
  };
  sharedDataSet.dataSet.attributes?.forEach(attr => {
    updatedIds.attributeIdMap[attr.id] = uniqueId();
  });
  sharedDataSet.dataSet.cases?.forEach(c => {
    if (c.__id__) updatedIds.caseIdMap[c.__id__] = newCaseId();
  });
  return updatedIds;
}

export function getSharedDataSetSnapshotWithUpdatedIds(
  sharedDataSet: SharedDataSetSnapshotType, updatedIds: UpdatedSharedDataSetIds
) {
  const newAttributes = sharedDataSet.dataSet.attributes?.map(a => {
    const formula = cloneDeep(a.formula);
    return { ...a, id: updatedIds.attributeIdMap[a.id], formula };
  });
  const newCases = sharedDataSet.dataSet.cases?.filter(c => c.__id__).map(c => (
    c.__id__ && { ...c, __id__: updatedIds.caseIdMap[c.__id__] }
  ));
  return {
    ...sharedDataSet,
    id: updatedIds.sharedModelId,
    dataSet: {
      ...sharedDataSet.dataSet,
      id: updatedIds.dataSetId,
      attributes: newAttributes,
      cases: newCases
    }
  };
}

export function updateSharedDataSetSnapshotWithNewTileIds(
  sharedDataSetSnapshot: SharedDataSetSnapshotType, tileIdMap: Record<string, string>
) {
  if (sharedDataSetSnapshot.providerId) {
    sharedDataSetSnapshot.providerId = tileIdMap[sharedDataSetSnapshot.providerId];
  }
}
