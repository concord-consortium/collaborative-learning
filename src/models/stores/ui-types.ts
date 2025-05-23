import { Instance, types } from "mobx-state-tree";

export const UIDialogTypeEnum = types.enumeration("dialogType", ["alert", "confirm", "prompt", "getCopyToDocument"]);
export type UIDialogType = Instance<typeof UIDialogTypeEnum>;
export const DocFilterTypeEnum = types.enumeration("docFilter", ["Problem", "Investigation", "Unit", "All"]);
export type DocFilterType = Instance<typeof DocFilterTypeEnum>;
export type PrimarySortType = "Bookmarked" | "Group" | "Name" | "Strategy" | "Tools";
export type SecondarySortType = PrimarySortType | "None";

export const kDividerMin = 0;   // left side (resources/navigation) is collapsed
export const kDividerHalf = 50; // resources/navigation and workspace are split 50/50
export const kDividerMax = 100; // right side (workspace) is collapsed
