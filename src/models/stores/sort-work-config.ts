import { types, SnapshotIn } from "mobx-state-tree";
import { DocFilterTypeEnum, SortTypeIds } from "./ui-types";

const SortTypeIdEnum = types.enumeration("SortTypeId", [...SortTypeIds]);

export const SortOptionConfigModel = types.model("SortOptionConfig", {
  label: types.maybe(types.string),
  type: SortTypeIdEnum
});

export const SortWorkConfigModel = types.model("SortWorkConfig", {
  docFilterOptions: types.maybe(types.array(DocFilterTypeEnum)),
  defaultPrimarySort: types.maybe(SortTypeIdEnum), // If unspecified, defaults to "Group" (or "Name" if groups disabled)
  showContextFilter: types.optional(types.boolean, true),
  sortOptions: types.maybe(types.array(SortOptionConfigModel))
});

export interface ISortOptionConfig extends SnapshotIn<typeof SortOptionConfigModel> {}
export interface ISortWorkConfig extends SnapshotIn<typeof SortWorkConfigModel> {}
