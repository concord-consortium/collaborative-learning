import React, { useEffect, useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

import { escapeKeyForForm } from "../../../utilities/sort-utils";
import { getDefaultValue, TranslationKeyType } from "../../../utilities/translation/translate";
import { useCurriculum } from "../../hooks/use-curriculum";

import "./term-overrides-settings.scss";

export interface TermMetadata {
  key: TranslationKeyType;
  label: string;  // User-friendly display name for authoring UI
  description: string;
}

function getTermMetadata(key: TranslationKeyType, description: string): TermMetadata {
  return { key, label: getDefaultValue(key) || key, description };
}

const strategyDescription =
  "The comment tag/strategy for sorting. The sort option will only appear if this term is overridden.";
export const termMetadata: TermMetadata[] = [
  getTermMetadata("studentGroup", "A group of students"),
  getTermMetadata("studentGroups", "Multiple groups of students"),
  getTermMetadata("sortLabel.sortByOwner", "Sort label for document owner/student"),
  getTermMetadata("Strategy", strategyDescription),
  getTermMetadata("Bookmarked", "Term for bookmarked documents"),
  getTermMetadata("Tools", "Term for CLUE tiles"),
  getTermMetadata("sortLabel.sortByDate", "Sort label for date"),
  getTermMetadata("Problem", "Term for the problems/tasks in the unit"),
  getTermMetadata("Problems", "Term for multiple problems/tasks in the unit"),
  getTermMetadata("Unit", "Term for the unit of study"),
  getTermMetadata("Units", "Term for multiple units of study"),
  getTermMetadata("Investigation", "Term for the investigation within a unit"),
  getTermMetadata("Investigations", "Term for multiple investigations within a unit"),
  getTermMetadata("Workspace", "The main editing/viewing panel (singular)"),
  getTermMetadata("Workspaces", "The main editing/viewing panel (plural)")
];

interface TermOverrideFormInputs {
  overrides: Record<string, string>;
}

export const TermOverridesSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();

  const formDefaults: TermOverrideFormInputs = useMemo(() => {
    const termOverrides = unitConfig?.config?.termOverrides ?? {};
    const overrides: Record<string, string> = {};

    termMetadata.forEach(term => {
      // Use escaped keys for React Hook Form compatibility
      overrides[escapeKeyForForm(term.key)] = termOverrides[term.key] ?? "";
    });

    return { overrides };
  }, [unitConfig]);

  const { handleSubmit, register, reset } = useForm<TermOverrideFormInputs>({
    defaultValues: formDefaults
  });

  // Reset form when unitConfig changes externally
  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  const onSubmit: SubmitHandler<TermOverrideFormInputs> = (data) => {
    setUnitConfig(draft => {
      if (!draft) return;

      const termOverrides: Record<string, string> = {};

      termMetadata.forEach(term => {
        // Form data uses escaped keys, but we save with real keys
        const escapedKey = escapeKeyForForm(term.key);
        const value = data.overrides[escapedKey]?.trim();
        const defaultVal = getDefaultValue(term.key);
        // Only save if value is non-empty and differs from the default
        if (value && value !== defaultVal) {
          termOverrides[term.key] = value;
        }
      });

      if (Object.keys(termOverrides).length > 0) {
        draft.config.termOverrides = termOverrides;
      } else {
        delete (draft.config as any).termOverrides;
      }
    });
  };

  const getEffectiveDefault = (termKey: TranslationKeyType): string => {
    return getDefaultValue(termKey) || "(no default)";
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="term-overrides-settings">
      <h3 id="term-overrides-heading">Term Overrides</h3>
      <p className="muted" id="term-overrides-description">
        Configure customized terminology. These overrides will replace the default terms in the CLUE app everywhere
        the terms appear.
      </p>

      <div className="term-list">
        {[...termMetadata].sort((a, b) => a.label.localeCompare(b.label)).map(term => {
          const effectiveDefault = getEffectiveDefault(term.key);

          return (
            <div key={term.key} className="term-item">
              <div className="term-header">
                <label htmlFor={`override-${term.key}`} className="term-label">
                  {term.label}
                </label>
                <span className="term-description muted">
                  {term.description}
                </span>
              </div>
              <div className="term-input-row">
                <input
                  id={`override-${term.key}`}
                  placeholder={effectiveDefault}
                  type="text"
                  {...register(`overrides.${escapeKeyForForm(term.key)}` as const)}
                />
              </div>
            </div>
          );
        })}
      </div>

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
