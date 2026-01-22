import { useMemo } from "react";
import { useStores } from "./use-stores";
import { ISortOptionConfig } from "../models/stores/sort-work-config";
import { PrimarySortType } from "../models/stores/ui-types";

export interface SortOptionDisplay {
  label: string;
  type: PrimarySortType;
}

const DEFAULT_LABELS: Record<PrimarySortType, string> = {
  Bookmarked: "Bookmarked",
  Date: "Date",
  Group: "Group",
  Name: "Student",
  Problem: "Problem",
  Strategy: "", // Will be overridden by tagPrompt
  Tools: "Tools"
};

// Default sort options when no configuration is provided
// Note: "Strategy" is only included if tagPrompt is configured
const DEFAULT_SORT_OPTIONS: ISortOptionConfig[] = [
  { type: "Date" },
  { type: "Group" },
  { type: "Name" },
  { type: "Strategy" },
  { type: "Bookmarked" },
  { type: "Tools" }
];

export function useSortOptions() {
  const { appConfig } = useStores();
  const { sortWorkConfig, tagPrompt, autoAssignStudentsToIndividualGroups } = appConfig;

  const sortOptions = useMemo(() => {
    const configOptions = sortWorkConfig?.sortOptions ?? DEFAULT_SORT_OPTIONS;

    return configOptions
      .filter(option => {
        // Filter out Group if groups are disabled
        if (option.type === "Group" && autoAssignStudentsToIndividualGroups) {
          return false;
        }
        // Filter out Strategy if no tagPrompt is configured
        if (option.type === "Strategy" && !tagPrompt) {
          return false;
        }
        return true;
      })
      .map(option => {
        const optionType = option.type;
        const defaultLabel = option.type === "Strategy" ? (tagPrompt || "") : DEFAULT_LABELS[optionType];
        const customLabel = appConfig.customLabels?.[optionType];
        return {
          type: optionType,
          label: customLabel ?? defaultLabel
        };
      });
  }, [sortWorkConfig?.sortOptions, autoAssignStudentsToIndividualGroups, tagPrompt, appConfig]);

  const showContextFilter = sortWorkConfig?.showContextFilter ?? true;

  const defaultPrimarySort = useMemo((): PrimarySortType => {
    // Only use configured default if it's actually available in the filtered options
    const configuredDefault = sortWorkConfig?.defaultPrimarySort;
    if (configuredDefault && sortOptions.some(opt => opt.type === configuredDefault)) {
      return configuredDefault;
    }
    // Fallback: Group if available, otherwise Name
    const hasGroup = sortOptions.some(opt => opt.type === "Group");
    if (hasGroup) return "Group";
    return "Name";
  }, [sortWorkConfig, sortOptions]);

  const getLabelForType = (type: PrimarySortType): string => {
    const option = sortOptions.find(opt => opt.type === type);
    if (option) return option.label;
    // Fallback for types not in current options (e.g., for secondary sort "None")
    if (type === "Strategy") return tagPrompt || DEFAULT_LABELS.Strategy;
    return DEFAULT_LABELS[type] || type;
  };

  const isValidSortType = (type: string): type is PrimarySortType => {
    return sortOptions.some(opt => opt.type === type);
  };

  return {
    defaultPrimarySort,
    getLabelForType,
    isValidSortType,
    sortOptions,
    showContextFilter
  };
}
