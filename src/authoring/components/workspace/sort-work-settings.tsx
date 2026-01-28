import React, { useEffect, useMemo } from "react";
import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";

import { ISortWorkConfig, SortTypeId, SortTypeIds } from "../../types";
import { useCurriculum } from "../../hooks/use-curriculum";
import { ISortOptionConfig } from "../../../models/stores/sort-work-config";
import { getSortTypeLabel } from "../../../utilities/sort-utils";
import { getSortTypeTranslationKey } from "../../../utilities/translation/translation-types";
import appConfig from "../../../clue/app-config.json";

import "./sort-work-settings.scss";

const defaultSortTypes = new Set(
  appConfig.config.sortWorkConfig?.sortOptions?.map((o: { type: string }) => o.type) ?? []
);

const sortOptionDescriptions: Record<SortTypeId, string> = {
  Group: "Sort documents by student group",
  Name: "Sort documents by individual student",
  Strategy: "Sort documents by comment tags",
  Bookmarked: "Sort documents by bookmark status",
  Tools: "Sort documents by tile types used",
  Date: "Sort documents by last modified date",
  Problem: "Sort documents by problem number"
};

interface FormSortOption {
  enabled: boolean;
  type: SortTypeId;
}

interface SortWorkSettingsFormInputs {
  defaultPrimarySort: SortTypeId | "";
  showContextFilter: boolean;
  sortOptions: FormSortOption[];
}

const SortWorkSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const tagPrompt = unitConfig?.config?.tagPrompt;
  const termOverrides = unitConfig?.config?.termOverrides;

  const formDefaults: SortWorkSettingsFormInputs = useMemo(() => {
    const currentConfig = unitConfig?.config?.sortWorkConfig;
    const enabledTypes = new Set(currentConfig?.sortOptions?.map(o => o.type) ?? []);

    // Build sort options - maintain order from config if it exists
    const orderedTypes: SortTypeId[] = currentConfig?.sortOptions
      ? [...currentConfig.sortOptions.map(o => o.type), ...SortTypeIds.filter(t => !enabledTypes.has(t))]
      : [...SortTypeIds];

    const sortOptions: FormSortOption[] = orderedTypes.map(type => {
      return {
        enabled: enabledTypes.size === 0 ? defaultSortTypes.has(type) : enabledTypes.has(type),
        type
      };
    });

    return {
      defaultPrimarySort: currentConfig?.defaultPrimarySort ?? "",
      showContextFilter: currentConfig?.showContextFilter ?? true,
      sortOptions
    };
  }, [unitConfig]);

  const { handleSubmit, register, control, watch, reset } = useForm<SortWorkSettingsFormInputs>({
    defaultValues: formDefaults
  });

  // Reset form when unitConfig changes externally
  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  const { fields, move } = useFieldArray({
    control,
    name: "sortOptions"
  });

  const watchSortOptions = watch("sortOptions");
  const enabledOptions = watchSortOptions?.filter(o => o.enabled) ?? [];

  const onSubmit: SubmitHandler<SortWorkSettingsFormInputs> = (data) => {
    const enabledSortOptions = data.sortOptions.filter(o => o.enabled);

    setUnitConfig(draft => {
      if (!draft) return;

      // Build sortOptions array from enabled options only
      const sortOptions: ISortOptionConfig[] = enabledSortOptions
        .map(o => ({ type: o.type }));

      const sortWorkConfig: ISortWorkConfig = {};

      if (sortOptions.length > 0) {
        sortWorkConfig.sortOptions = sortOptions;
      }

      const enabledTypes = sortOptions.map(o => o.type);
      if (data.defaultPrimarySort && enabledTypes.includes(data.defaultPrimarySort)) {
        sortWorkConfig.defaultPrimarySort = data.defaultPrimarySort;
      }

      if (!data.showContextFilter) {
        sortWorkConfig.showContextFilter = false;
      }

      if (Object.keys(sortWorkConfig).length > 0) {
        draft.config.sortWorkConfig = sortWorkConfig;
      } else {
        delete draft.config.sortWorkConfig;
      }
    });
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < fields.length) {
      move(index, newIndex);
    }
  };

  const getDisplayLabel = (type: SortTypeId) => {
    return getSortTypeLabel(type, { tagPrompt, termOverrides });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="sort-work-settings">
      <h3 id="sort-work-heading">Sort Work Tab Configuration</h3>
      <p className="muted" id="sort-work-description">
        Configure which sort options are available on the Sort Work tab.
      </p>

      <fieldset>
        <legend>Context Filter</legend>
        <label className="horizontal middle">
          <input
            aria-describedby="context-filter-description"
            type="checkbox"
            {...register("showContextFilter")}
          />
          <span>Enable &quot;Show for&quot; filter</span>
        </label>
        <p className="muted small" id="context-filter-description">
          When enabled, shows a dropdown to filter documents by Problem, Investigation, Unit, or All.
        </p>
      </fieldset>

      <fieldset>
        <legend>Sort Options</legend>
        <p className="muted small" id="sort-options-description">
          Check the options to enable them. Use arrow buttons to reorder.
          Labels can be customized on the <a href="#termOverrides">Term Overrides page</a>.
          Labels marked with an <span className="custom-label-indicator">*</span> have been customized.
        </p>
        <table aria-describedby="sort-options-description" role="grid">
          <thead>
            <tr>
              <th className="enabled" scope="col">Enabled</th>
              <th className="order" scope="col">Order</th>
              <th className="sort-type" scope="col">Sort Type</th>
              <th className="description" scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const sortType = field.type;
              const displayLabel = getDisplayLabel(sortType);
              const rowId = `sort-option-${sortType}`;
              const watchedOption = watchSortOptions[index];
              const isOnlyEnabledOption = enabledOptions.length === 1 && watchedOption?.enabled;
              const hasCustomLabel = !!termOverrides?.[getSortTypeTranslationKey(sortType)];

              return (
                <tr key={field.id} id={rowId}>
                  <td className="enabled">
                    <input
                      aria-label={`Enable ${displayLabel} sort option`}
                      disabled={isOnlyEnabledOption}
                      title={isOnlyEnabledOption ? "At least one sort option must remain enabled" : undefined}
                      type="checkbox"
                      {...register(`sortOptions.${index}.enabled`)}
                    />
                  </td>
                  <td className="narrow order order-buttons">
                    <button
                      aria-label={`Move ${displayLabel} up`}
                      disabled={index === 0}
                      onClick={() => moveOption(index, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${displayLabel} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => moveOption(index, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                  </td>
                  <td className="sort-type">
                    {displayLabel}
                    {hasCustomLabel && <span className="custom-label-indicator" title="Custom label applied">*</span>}
                    <input type="hidden" {...register(`sortOptions.${index}.type`)} />
                  </td>
                  <td className="description">
                    {sortOptionDescriptions[sortType]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>

      <fieldset>
        <legend>Default Primary Sort</legend>
        <select
          aria-describedby="default-sort-description"
          {...register("defaultPrimarySort")}
        >
          <option value="">Auto (Group → Name → first available option)</option>
          {enabledOptions.map(option => {
            const label = getDisplayLabel(option.type);
            return (
              <option key={option.type} value={option.type}>
                {label}
              </option>
            );
          })}
        </select>
        <p className="muted small" id="default-sort-description">
          The sort option selected by default when a user first visits the Sort Work tab.
        </p>
      </fieldset>

      <div className="bottomButtons">
        <button
          aria-busy={saveState === "saving"}
          disabled={saveState === "saving"}
          type="submit"
        >
          {saveState === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
};

export default SortWorkSettings;
