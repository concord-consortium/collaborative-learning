import { Instance, types } from "mobx-state-tree";

export const UIDialogTypeEnum = types.enumeration("dialogType", ["alert", "confirm", "prompt", "getCopyToDocument"]);
export type UIDialogType = Instance<typeof UIDialogTypeEnum>;

// "All" is not overrideable
export const OverrideableDocFilterTypeIds = ["Problem", "Investigation", "Unit"] as const;
export type OverrideableDocFilterTypeId = typeof OverrideableDocFilterTypeIds[number];
export function isOverrideableDocFilterTypeId(value: string): value is OverrideableDocFilterTypeId {
  return OverrideableDocFilterTypeIds.includes(value as OverrideableDocFilterTypeId);
}

// But all is a possible filter type
export const DocFilterTypeIds = [...OverrideableDocFilterTypeIds, "All"] as const;
export type DocFilterTypeId = typeof DocFilterTypeIds[number];
export const DocFilterTypeEnum = types.enumeration("docFilter", DocFilterTypeIds);
export type DocFilterType = Instance<typeof DocFilterTypeEnum>;

export const SortTypeIds = ["Date", "Group", "Name", "Strategy", "Bookmarked", "Tools", "Problem"] as const;
export type SortTypeId = typeof SortTypeIds[number];

export type PrimarySortType = SortTypeId;
export type SecondarySortType = PrimarySortType | "None";
export type SortType = PrimarySortType | SecondarySortType | "All";

export const kDividerMin = 0;   // left side (resources/navigation) is collapsed
export const kDividerHalf = 50; // resources/navigation and workspace are split 50/50
export const kDividerMax = 100; // right side (workspace) is collapsed
