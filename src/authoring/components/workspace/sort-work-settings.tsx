import React, { useEffect, useMemo } from "react";
import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";

import { ISortOptionConfig, ISortWorkConfig, SortTypeId, sortTypeIds } from "../../types";
import { useCurriculum } from "../../hooks/use-curriculum";

import "./sort-work-settings.scss";

const defaultLabels: Record<SortTypeId, string> = {
  Bookmarked: "Bookmarked",
  Date: "Date",
  Group: "Group",
  Name: "Name",
  Problem: "Problem",
  Strategy: "Strategy",
  Tools: "Tools"
};

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
  enabled: boolean;
  label: string;
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
    const enabledTypes = currentConfig?.sortOptions?.map(o => o.type) ?? [];
    const defaultEnabledTypes: SortTypeId[] = ["Group", "Name", "Strategy", "Bookmarked", "Tools", "Date"];

    // Build sort options - maintain order from config if it exists
    const orderedTypes: SortTypeId[] = currentConfig?.sortOptions
      ? [...currentConfig.sortOptions.map(o => o.type), ...sortTypeIds.filter(t => !enabledTypes.includes(t))]
      : [...sortTypeIds];

    const sortOptions: FormSortOption[] = orderedTypes.map(type => {
      const configOption = currentConfig?.sortOptions?.find(o => o.type === type);

      return {
        type,
        label: configOption?.label ?? "",
        enabled: enabledTypes.length === 0 ? defaultEnabledTypes.includes(type) : enabledTypes.includes(type)
      };
    });

    return {
      defaultPrimarySort: currentConfig?.defaultPrimarySort ?? "",
      showContextFilter: currentConfig?.showContextFilter ?? true,
      sortOptions
    };
  }, [unitConfig]);

  const { handleSubmit, register, control, watch, reset } = useForm<SortWorkSettingsFormInputs>({ defaultValues: formDefaults });

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
    setUnitConfig(draft => {
      if (!draft) return;

      // Build sortOptions array from enabled options only
      const sortOptions: ISortOptionConfig[] = data.sortOptions
        .filter(o => o.enabled)
        .map(o => {
          const option: ISortOptionConfig = { type: o.type };
          // Only include label if it differs from default
          if (o.label.trim() && o.label.trim() !== getDisplayLabel(o.type)) {
            option.label = o.label.trim();
          }
          return option;
        });

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
    });
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < fields.length) {
      move(index, newIndex);
    }
  };

  const getDisplayLabel = (type: SortTypeId) => {
    return type === "Strategy" && tagPrompt ? tagPrompt : defaultLabels[type];
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

              return (
                <tr key={field.id} id={rowId}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Enable ${displayLabel} sort option`}
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
                      {...register(`sortOptions.${index}.label`)}
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
          <option value="">Auto (Group if available, else Name)</option>
          {enabledOptions.map(option => {
            const displayLabel = getDisplayLabel(option.type);
            const label = option.label.trim() || displayLabel;
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
