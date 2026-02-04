import React, { useEffect, useMemo } from "react";
import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";

import appConfig from "../../../clue/app-config.json";
import { ISortOptionConfig } from "../../../models/stores/sort-work-config";
import { DocFilterType, DocFilterTypeIds } from "../../../models/stores/ui-types";
import { getSortTypeTranslationKey } from "../../../utilities/sort-utils";
import { upperWords } from "../../../utilities/string-utils";
import {
  getDefaultValue, isTranslationKey, setTermOverrides, translate
} from "../../../utilities/translation/translate";
import { useCurriculum } from "../../hooks/use-curriculum";
import { ISortWorkConfig, SortTypeId, SortTypeIds } from "../../types";

import "./sort-work-settings.scss";

const defaultSortTypes = new Set(
  appConfig.config.sortWorkConfig?.sortOptions?.map((o: { type: string }) => o.type) ?? []
);

const sortOptionDescriptions: Record<SortTypeId, string> = {
  Group: "Sort documents by student group",
  Name: "Sort documents by individual student",
  Strategy: "Sort documents by comment tags (only appears if a custom label has been set)",
  Bookmarked: "Sort documents by bookmark status",
  Tools: "Sort documents by tile types used",
  Date: "Sort documents by last modified date",
  Problem: "Sort documents by problem number"
};

interface DocFilterOption {
  enabled: boolean;
  type: DocFilterType;
}

interface FormSortOption {
  enabled: boolean;
  type: SortTypeId;
}

interface SortWorkSettingsFormInputs {
  defaultPrimarySort: SortTypeId | "";
  docFilterOptions: DocFilterOption[];
  showContextFilter: boolean;
  sortOptions: FormSortOption[];
}

const SortWorkSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const termOverrides = unitConfig?.config?.termOverrides;

  const formDefaults: SortWorkSettingsFormInputs = useMemo(() => {
    const currentConfig = unitConfig?.config?.sortWorkConfig;
    const enabledTypes = new Set(currentConfig?.sortOptions?.map(o => o.type) ?? []);

    // Build doc filter options - maintain order from config if it exists
    const enabledDocFilterTypes = new Set(currentConfig?.docFilterOptions ?? []);
    const docFilterTypes: DocFilterType[] = currentConfig?.docFilterOptions
      ? [...currentConfig.docFilterOptions, ...DocFilterTypeIds.filter(t => !enabledDocFilterTypes.has(t))]
      : [...DocFilterTypeIds];
    const docFilterOptions: DocFilterOption[] = docFilterTypes.map(type => {
      return {
        enabled: enabledDocFilterTypes.size === 0 ? true : enabledDocFilterTypes.has(type),
        type
      };
    });

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
      docFilterOptions,
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

  // Ensure translations always use the latest termOverrides
  useEffect(() => {
    setTermOverrides(termOverrides);
  }, [termOverrides]);

  const { fields, move } = useFieldArray({
    control,
    name: "sortOptions"
  });

  const { fields: docFilterFields } = useFieldArray({
    control,
    name: "docFilterOptions"
  });

  const watchSortOptions = watch("sortOptions");
  const enabledSortOptions = watchSortOptions?.filter(o => o.enabled) ?? [];

  const watchDocFilterOptions = watch("docFilterOptions");
  const enabledDocFilterOptions = watchDocFilterOptions?.filter(o => o.enabled) ?? [];

  const onSubmit: SubmitHandler<SortWorkSettingsFormInputs> = (data) => {
    const formEnabledSortOptions = data.sortOptions.filter(o => o.enabled);
    const formEnabledDocFilterOptions = data.docFilterOptions.filter(o => o.enabled);

    setUnitConfig(draft => {
      if (!draft) return;

      // Build sortOptions array from enabled options only
      const sortOptions: ISortOptionConfig[] = formEnabledSortOptions.map(o => ({ type: o.type }));

      const sortWorkConfig: ISortWorkConfig = {};

      if (formEnabledDocFilterOptions.length > 0) {
        sortWorkConfig.docFilterOptions = formEnabledDocFilterOptions.map(o => o.type);
      }

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="sort-work-settings">
      <h3 id="sort-work-heading">Sort Work Tab Configuration</h3>
      <p className="muted" id="sort-work-description">
        Configure which sort options are available on the Sort Work tab.
      </p>

      <fieldset>
        <legend>Sort Options</legend>
        <p className="muted small" id="sort-options-description">
          Check the options to enable them. Use arrow buttons to reorder.
          Labels can be customized on the Term Overrides page.
        </p>
        <table aria-describedby="sort-options-description" role="grid">
          <thead>
            <tr>
              <th className="enabled" scope="col">Enabled</th>
              <th className="order" scope="col">Order</th>
              <th className="sort-type" scope="col">Sort Type</th>
              <th className="label" scope="col">Label</th>
              <th className="description" scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const sortType = field.type;
              const translationKey = getSortTypeTranslationKey(sortType);
              const defaultValue = upperWords(getDefaultValue(translationKey)) || sortType;
              const displayLabel = upperWords(translate(translationKey));
              const rowId = `sort-option-${sortType}`;
              const watchedOption = watchSortOptions[index];
              const isOnlyEnabledOption = enabledSortOptions.length === 1 && watchedOption?.enabled;

              return (
                <tr key={field.id} id={rowId}>
                  <td className="enabled">
                    <input
                      aria-label={`Enable ${defaultValue} sort option`}
                      disabled={isOnlyEnabledOption}
                      title={isOnlyEnabledOption ? "At least one sort option must remain enabled" : undefined}
                      type="checkbox"
                      {...register(`sortOptions.${index}.enabled`)}
                    />
                  </td>
                  <td className="narrow order order-buttons">
                    <button
                      aria-label={`Move ${defaultValue} up`}
                      disabled={index === 0}
                      onClick={() => moveOption(index, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${defaultValue} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => moveOption(index, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                  </td>
                  <td className="sort-type">
                    {defaultValue}
                    <input type="hidden" {...register(`sortOptions.${index}.type`)} />
                  </td>
                  <td className="label">{displayLabel}</td>
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
          {enabledSortOptions.map(option => {
            return (
              <option key={option.type} value={option.type}>
                {getDefaultValue(getSortTypeTranslationKey(option.type))}
              </option>
            );
          })}
        </select>
        <p className="muted small" id="default-sort-description">
          The sort option selected by default when a user first visits the Sort Work tab.
        </p>
      </fieldset>

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
        <legend>Filter Options</legend>
        <p className="muted small" id="filter-options-description">
          Check the options to enable them.
          Labels can be customized on the Term Overrides page.
        </p>
        <table aria-describedby="filter-options-description" role="grid">
          <thead>
            <tr>
              <th className="enabled" scope="col">Enabled</th>
              <th className="filter-type" scope="col">Filter Type</th>
              <th className="label" scope="col">Label</th>
            </tr>
          </thead>
          <tbody>
            {docFilterFields.map((field, index) => {
              const docFilterType = field.type;
              const defaultValue = isTranslationKey(docFilterType) ? getDefaultValue(docFilterType) : docFilterType;
              const displayLabel = isTranslationKey(docFilterType) ? translate(docFilterType): docFilterType;
              const rowId = `doc-filter-option-${docFilterType}`;
              const watchedOption = watchDocFilterOptions[index];
              const isOnlyEnabledOption = enabledDocFilterOptions.length === 1 && watchedOption?.enabled;

              return (
                <tr key={field.id} id={rowId}>
                  <td className="enabled">
                    <input
                      aria-label={`Enable ${defaultValue} filter option`}
                      disabled={isOnlyEnabledOption}
                      title={isOnlyEnabledOption ? "At least one filter option must remain enabled" : undefined}
                      type="checkbox"
                      {...register(`docFilterOptions.${index}.enabled`)}
                    />
                  </td>
                  <td className="filter-type">
                    {defaultValue}
                    <input type="hidden" {...register(`docFilterOptions.${index}.type`)} />
                  </td>
                  <td className="label">{displayLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
