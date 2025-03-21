import { getType, Instance, SnapshotIn, types } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { Required } from "utility-types";
import escapeStringRegexp from "escape-string-regexp";

import { SharedModel, SharedModelType } from "./shared-model";
import { DataSet, IDataSet, newCaseId } from "../data/data-set";
import { uniqueId } from "../../utilities/js-utils";

export const kSharedDataSetType = "SharedDataSet";

export const SharedDataSet = SharedModel
.named("SharedDataSet")
.props({
  type: types.optional(types.literal(kSharedDataSetType), kSharedDataSetType),
  providerId: "",
  dataSet: types.optional(DataSet, () => DataSet.create())
})
.views(self => ({
  get name() {
    return self.dataSet.name;
  },
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
  },
  setName(name: string) {
    self.dataSet.setName(name);
  }
}));
// all instances have a dataSet, but types.optional() leads to a TypeScript type that doesn't reflect that
export interface SharedDataSetType extends Required<Instance<typeof SharedDataSet>, "dataSet"> {}

export function isSharedDataSet(model?: SharedModelType): model is SharedDataSetType {
  return model ? getType(model) === SharedDataSet : false;
}

export interface SharedDataSetSnapshotType extends SnapshotIn<typeof SharedDataSet> {}

export function isSharedDataSetSnapshot(snapshot: any): snapshot is SharedDataSetSnapshotType {
  return snapshot.type === kSharedDataSetType;
}

export interface UpdatedSharedDataSetIds {
  attributeIdMap: Record<string, string>;
  caseIdMap: Record<string, string>;
  origDataSetId: string|undefined;
  dataSetId: string;
  sharedModelId: string;
}

export function getUpdatedSharedDataSetIds(sharedDataSet: SharedDataSetSnapshotType) {
  const updatedIds: UpdatedSharedDataSetIds = {
    attributeIdMap: {},
    caseIdMap: {},
    origDataSetId: sharedDataSet.dataSet?.id,
    dataSetId: uniqueId(),
    sharedModelId: uniqueId()
  };
  sharedDataSet.dataSet?.attributes?.forEach(attr => {
    if (attr.id) {
      updatedIds.attributeIdMap[attr.id] = uniqueId();
    }
  });
  sharedDataSet.dataSet?.cases?.forEach(c => {
    if (c.__id__) updatedIds.caseIdMap[c.__id__] = newCaseId();
  });
  return updatedIds;
}

export function getSharedDataSetSnapshotWithUpdatedIds(
  sharedDataSet: SharedDataSetSnapshotType, updatedIds: UpdatedSharedDataSetIds
) {
  const newAttributes = sharedDataSet.dataSet?.attributes?.map(a => {
    const formula = cloneDeep(a.formula);
    if (a.id) {
      return { ...a, id: updatedIds.attributeIdMap[a.id], formula };
    }
  });
  const newCases = sharedDataSet.dataSet?.cases?.filter(c => c.__id__).map(c => (
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
  sharedDataSetSnapshot: SharedDataSetSnapshotType, tileIdMap: Record<string, string>) {
  // Always makes a copy, so that returned object is not read-only
  if (sharedDataSetSnapshot.providerId) {
    return cloneDeep({
      ...sharedDataSetSnapshot,
      providerId: tileIdMap[sharedDataSetSnapshot.providerId]
    });
  } else {
    return cloneDeep(sharedDataSetSnapshot);
  }
}

function flattenedMap(sharedDatasetIds: UpdatedSharedDataSetIds[]) {
  const map = {} as Record<string, string>;
  for (const updatedIds of sharedDatasetIds) {
    if (updatedIds.origDataSetId) {
      map[updatedIds.origDataSetId] = updatedIds.dataSetId;
    }
    for (const [key, val] of Object.entries(updatedIds.attributeIdMap)) {
      map[key] = val;
    }
    for (const [key, val] of Object.entries(updatedIds.caseIdMap)) {
      map[key] = val;
    }
  }
  return map;
}

/**
 * Find all IDs referenced in the JSON and replace them. This method assumes
 * we're dealing with IDs that are globally unique, so all the replacement lists
 * can be merged together without duplication.
 *
 * The separator pattern is normally just a double quote, if IDs are expected to
 * be found as string values in the JSON. However, it can be a different string;
 * for example the Geometry uses quote and colon since there are JSON values
 * like "ID:ID" and each ID needs to be separately replaced.
 * @param json
 * @param separator
 * @param sharedDatasetIds
 * @returns updated json
 */
export function replaceJsonStringsWithUpdatedIds(json: unknown, separator: string,
    ...sharedDatasetIds: UpdatedSharedDataSetIds[]) {
  const flatMap = flattenedMap(sharedDatasetIds);
  const keys = Object.keys(flatMap);
  if (keys.length === 0) { return json; }

  const keyPattern = keys.map(key => escapeStringRegexp(key)).join("|");
  const matchRegexp = new RegExp(`(?<=${separator})(${keyPattern})(?=${separator})`, "g");
  const updated = JSON.stringify(json).replace(matchRegexp, (match) => {
    return `${flatMap[match]}`;
  });
  return JSON.parse(updated);
}
