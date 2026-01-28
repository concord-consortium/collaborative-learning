import { useMemo } from "react";
import { useStores } from "./use-stores";
import { translate } from "../utilities/translation/translate";
import { getSortTypeTranslationKey } from "../utilities/translation/translation-types";
import { ISortOptionConfig } from "../models/stores/sort-work-config";
import { PrimarySortType } from "../models/stores/ui-types";

// Display version of ISortOptionConfig with required label
export interface SortOptionDisplay extends Omit<ISortOptionConfig, "label"> {
  label: string;
  type: PrimarySortType;
}

export function useSortOptions() {
  const { appConfig } = useStores();
  const { sortWorkConfig, tagPrompt, autoAssignStudentsToIndividualGroups } = appConfig;

  const sortOptions = useMemo(() => {
    const configOptions = sortWorkConfig?.sortOptions ?? [];

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
        label: translate(getSortTypeTranslationKey(option.type))
      }));
  }, [sortWorkConfig?.sortOptions, autoAssignStudentsToIndividualGroups, tagPrompt]);

  const sortOptionsByType = useMemo(() => {
    const map = new Map<PrimarySortType, SortOptionDisplay>();
    sortOptions.forEach(option => map.set(option.type, option));
    return map;
  }, [sortOptions]);

  const showContextFilter = sortWorkConfig?.showContextFilter ?? true;

  const defaultPrimarySort = useMemo((): PrimarySortType => {
    // Only use configured default if it's actually available in the filtered options
    const configuredDefault = sortWorkConfig?.defaultPrimarySort;
    if (configuredDefault && sortOptionsByType.has(configuredDefault)) {
      return configuredDefault;
    }
    // Fallback hierarchy: Group → Name → first available option
    if (sortOptionsByType.has("Group")) return "Group";
    if (sortOptionsByType.has("Name")) return "Name";

    if (sortOptions.length > 0) {
      return sortOptions[0].type;
    }

    // Ultimate fallback. This should not happen with proper configuration
    // but we need to return a valid PrimarySortType
    return "Date";
  }, [sortWorkConfig, sortOptions, sortOptionsByType]);

  const getLabelForType = (type: PrimarySortType): string => {
    return translate(getSortTypeTranslationKey(type));
  };

  const isValidSortType = (type: string): type is PrimarySortType => {
    return sortOptionsByType.has(type as PrimarySortType);
  };

  return {
    defaultPrimarySort,
    getLabelForType,
    isValidSortType,
    sortOptions,
    showContextFilter
  };
}
