import { useMemo } from "react";
import { useStores } from "./use-stores";
import { useTranslation } from "./use-translation";
import { ISortOptionConfig } from "../models/stores/sort-work-config";
import { PrimarySortType, DEFAULT_SORT_TYPES } from "../models/stores/ui-types";

// Display version of ISortOptionConfig with required label
export interface SortOptionDisplay extends Omit<ISortOptionConfig, "label"> {
  label: string;
  type: PrimarySortType;
}

// Default sort options when no configuration is provided
const DEFAULT_SORT_OPTIONS: ISortOptionConfig[] = DEFAULT_SORT_TYPES.map(type => ({ type }));

export function useSortOptions() {
  const { appConfig } = useStores();
  const { sortWorkConfig, tagPrompt, autoAssignStudentsToIndividualGroups } = appConfig;
  const { t } = useTranslation();

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
      .map(option => ({
        type: option.type,
        label: t(option.type)
      }));
  }, [sortWorkConfig?.sortOptions, autoAssignStudentsToIndividualGroups, tagPrompt, t]);

  const sortOptionsByType = useMemo(() => {
    const typeSet = new Set<PrimarySortType>();
    const typeMap = new Map<PrimarySortType, SortOptionDisplay>();

    sortOptions.forEach(option => {
      typeSet.add(option.type);
      typeMap.set(option.type, option);
    });

    return { typeSet, typeMap };
  }, [sortOptions]);

  const showContextFilter = sortWorkConfig?.showContextFilter ?? true;

  const defaultPrimarySort = useMemo((): PrimarySortType => {
    // Only use configured default if it's actually available in the filtered options
    const configuredDefault = sortWorkConfig?.defaultPrimarySort;
    if (configuredDefault && sortOptionsByType.typeSet.has(configuredDefault)) {
      return configuredDefault;
    }
    // Fallback hierarchy: Group → Name → first available option
    if (sortOptionsByType.typeSet.has("Group")) return "Group";
    if (sortOptionsByType.typeSet.has("Name")) return "Name";

    if (sortOptions.length > 0) {
      return sortOptions[0].type;
    }

    // Ultimate fallback. This should not happen with proper configuration
    // but we need to return a valid PrimarySortType
    return "Date";
  }, [sortWorkConfig, sortOptions, sortOptionsByType]);

  const getLabelForType = (type: PrimarySortType): string => {
    const option = sortOptionsByType.typeMap.get(type);
    if (option) return option.label;
    // Fallback for types not in current options (e.g., for secondary sort "None")
    return t(type);
  };

  const isValidSortType = (type: string): type is PrimarySortType => {
    return sortOptionsByType.typeSet.has(type as PrimarySortType);
  };

  return {
    defaultPrimarySort,
    getLabelForType,
    isValidSortType,
    sortOptions,
    showContextFilter
  };
}
