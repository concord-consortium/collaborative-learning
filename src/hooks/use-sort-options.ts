import { useMemo } from "react";
import { useStores } from "./use-stores";
import { ISortOptionConfig } from "../models/stores/sort-work-config";
import { PrimarySortType } from "../models/stores/ui-types";
import { getSortTypeTranslationKey } from "../utilities/sort-utils";
import { upperWords } from "../utilities/string-utils";
import { getTermOverride, translate } from "../utilities/translation/translate";

// Display version of ISortOptionConfig with required label
export interface SortOptionDisplay extends Omit<ISortOptionConfig, "label"> {
  label: string;
  type: PrimarySortType;
}

export function useSortOptions() {
  const { appConfig } = useStores();
  const { sortWorkConfig, autoAssignStudentsToIndividualGroups } = appConfig;

  const sortOptions = useMemo(() => {
    const configOptions = sortWorkConfig?.sortOptions ?? [];

    return configOptions
      .filter(option => {
        // Filter out Group if groups are disabled
        if (option.type === "Group" && autoAssignStudentsToIndividualGroups) {
          return false;
        }
        // Only include Strategy if the term has been overridden
        if (option.type === "Strategy" && !getTermOverride("strategy")) {
          return false;
        }
        return true;
      })
      .map(option => ({
        type: option.type,
        label: upperWords(translate(getSortTypeTranslationKey(option.type)))
      }));
  }, [sortWorkConfig?.sortOptions, autoAssignStudentsToIndividualGroups]);

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

  const isValidSortType = (type: string): type is PrimarySortType => {
    return sortOptionsByType.has(type as PrimarySortType);
  };

  return {
    defaultPrimarySort,
    isValidSortType,
    sortOptions,
    showContextFilter
  };
}
