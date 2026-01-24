import React, { useEffect, useMemo } from "react";
import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";

import { ISortWorkConfig, SortTypeId, sortTypeIds } from "../../types";
import { useCurriculum } from "../../hooks/use-curriculum";
import { ISortOptionConfig } from "../../../models/stores/sort-work-config";
import { DEFAULT_SORT_LABELS } from "../../../models/stores/ui-types";
import { getSortTypeLabel } from "../../../utilities/sort-utils";

import "./sort-work-settings.scss";

// Authoring-specific labels
const authoringLabels: Record<SortTypeId, string> = {
  ...DEFAULT_SORT_LABELS,
  Name: "Name", // Override "Student" with "Name" for authoring
  Strategy: "Strategy" // Override empty string with "Strategy" for authoring
};

const defaultEnabledTypes: SortTypeId[] = ["Group", "Name", "Strategy", "Bookmarked", "Tools", "Date"];

const sortTypeDescriptions: Record<SortTypeId, string> = {
  Bookmarked: "Sorts documents by bookmarked status",
  Date: "Sorts documents by creation date",
  Group: "Sorts documents by student group",
  Name: "Sorts documents by student name",
  Problem: "Sorts documents by problem",
  Strategy: "Sorts documents by comment tag/strategy",
  Tools: "Sorts documents by tile types used"
};

interface FormSortOption {
  customLabel: string;
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

  const formDefaults: SortWorkSettingsFormInputs = useMemo(() => {
    const currentConfig = unitConfig?.config?.sortWorkConfig;
    const customLabels = unitConfig?.config?.customLabels;
    const enabledTypes = new Set(currentConfig?.sortOptions?.map(o => o.type) ?? []);

    // Build sort options - maintain order from config if it exists
    const orderedTypes: SortTypeId[] = currentConfig?.sortOptions
      ? [...currentConfig.sortOptions.map(o => o.type), ...sortTypeIds.filter(t => !enabledTypes.has(t))]
      : [...sortTypeIds];

    const sortOptions: FormSortOption[] = orderedTypes.map(type => {
      return {
        type,
        customLabel: customLabels?.[type] ?? "", // Empty string means the default label is used.
        enabled: enabledTypes.size === 0 ? defaultEnabledTypes.includes(type) : enabledTypes.has(type)
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
    // Validate at least one sort option is enabled
    const enabledSortOptions = data.sortOptions.filter(o => o.enabled);
    if (enabledSortOptions.length === 0) {
      alert("At least one sort option must be enabled for the Sort Work tab to function.");
      return;
    }

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
        delete (draft.config as any).sortWorkConfig;
      }

      // Save custom labels separately
      const customLabels: Record<string, string> = {};
      data.sortOptions.forEach(o => {
        const trimmedLabel = o.customLabel.trim();
        // Only include label if it differs from default
        if (trimmedLabel && trimmedLabel !== getDisplayLabel(o.type)) {
          customLabels[o.type] = trimmedLabel;
        }
      });

      if (Object.keys(customLabels).length > 0) {
        draft.config.customLabels = customLabels;
      } else {
        delete (draft.config as any).customLabels;
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
    return getSortTypeLabel(type, { tagPrompt, baseLabels: authoringLabels });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="sort-work-settings">
      <h3 id="sort-work-heading">Sort Work Tab Configuration</h3>
      <p className="muted" id="sort-work-description">
        Configure which sort options are available on the Sort Work tab and customize their labels.
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
          Check the options to enable them. Use arrows to reorder.
          Custom labels override the default display text.
        </p>
        <table aria-describedby="sort-options-description" role="grid">
          <thead>
            <tr>
              <th scope="col">Enabled</th>
              <th scope="col">Order</th>
              <th scope="col">Sort Type</th>
              <th scope="col">Custom Label</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const sortType = field.type;
              const displayLabel = getDisplayLabel(sortType);
              const rowId = `sort-option-${sortType}`;
              const watchedOption = watchSortOptions[index];
              const isOnlyEnabledOption = enabledOptions.length === 1 && watchedOption?.enabled;

              return (
                <tr key={field.id} id={rowId}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Enable ${displayLabel} sort option`}
                      disabled={isOnlyEnabledOption}
                      title={isOnlyEnabledOption ? "At least one sort option must remain enabled" : undefined}
                      {...register(`sortOptions.${index}.enabled`)}
                    />
                  </td>
                  <td className="narrow order-buttons">
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
                  <td className="left">
                    {displayLabel}
                    <input type="hidden" {...register(`sortOptions.${index}.type`)} />
                  </td>
                  <td className="wide">
                    <input
                      aria-label={`Custom label for ${displayLabel}`}
                      placeholder={displayLabel}
                      type="text"
                      {...register(`sortOptions.${index}.customLabel`)}
                    />
                  </td>
                  <td className="left muted small">
                    {sortTypeDescriptions[sortType]}
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
            const label = option.customLabel.trim() || getDisplayLabel(option.type);
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
        <button type="submit" disabled={saveState === "saving"} aria-busy={saveState === "saving"}>
          {saveState === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
};

export default SortWorkSettings;
