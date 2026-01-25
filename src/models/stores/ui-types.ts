import { Instance, types } from "mobx-state-tree";

export const UIDialogTypeEnum = types.enumeration("dialogType", ["alert", "confirm", "prompt", "getCopyToDocument"]);
export type UIDialogType = Instance<typeof UIDialogTypeEnum>;
export const DocFilterTypeEnum = types.enumeration("docFilter", ["Problem", "Investigation", "Unit", "All"]);
export type DocFilterType = Instance<typeof DocFilterTypeEnum>;

export const SortTypeIds = ["Date", "Group", "Name", "Strategy", "Bookmarked", "Tools", "Problem"] as const;
export type SortTypeId = typeof SortTypeIds[number];

export type PrimarySortType = SortTypeId;
export type SecondarySortType = PrimarySortType | "None";
export type SortType = PrimarySortType | SecondarySortType | "All";

// Default labels for sort types
export const DEFAULT_SORT_LABELS: Record<PrimarySortType, string> = {
  Bookmarked: "Bookmarked",
  Date: "Date",
  Group: "Group",
  Name: "Student", // "Student" is preferred for UI display
  Problem: "Problem",
  Strategy: "", // Will be overridden by tagPrompt at runtime
  Tools: "Tools"
};

// Default sort options in preferred order
export const DEFAULT_SORT_TYPES: readonly PrimarySortType[] = [
  "Date", "Group", "Name", "Strategy", "Bookmarked", "Tools"
] as const;

export const kDividerMin = 0;   // left side (resources/navigation) is collapsed
export const kDividerHalf = 50; // resources/navigation and workspace are split 50/50
export const kDividerMax = 100; // right side (workspace) is collapsed
