import { types, SnapshotIn } from "mobx-state-tree";
import { DocFilterTypeEnum, SortTypeIds } from "./ui-types";

const SortTypeIdEnum = types.enumeration("SortTypeId", [...SortTypeIds]);

export const SortWorkConfigModel = types.model("SortWorkConfig", {
  docFilterOptions: types.maybe(types.array(DocFilterTypeEnum)),
  defaultPrimarySort: types.maybe(SortTypeIdEnum), // If unspecified, defaults to "Group" (or "Name" if groups disabled)
  showContextFilter: types.optional(types.boolean, true),
  sortOptions: types.maybe(types.array(SortTypeIdEnum))
});

export interface ISortWorkConfig extends SnapshotIn<typeof SortWorkConfigModel> {}
