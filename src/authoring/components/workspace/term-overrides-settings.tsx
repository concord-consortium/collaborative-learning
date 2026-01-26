import React, { useEffect, useMemo, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

import { useCurriculum } from "../../hooks/use-curriculum";
import { TERM_METADATA, TranslationKeyType } from "../../../utilities/translation";

import "./term-overrides-settings.scss";

const reservedValues = new Set<string>();
TERM_METADATA.forEach(term => {
  reservedValues.add(term.key);
  if (term.defaultValue) {
    reservedValues.add(term.defaultValue);
  }
});

interface TermOverrideFormInputs {
  overrides: Record<TranslationKeyType, string>;
}

interface ConflictWarning {
  conflictsWith: string;
  termKey: TranslationKeyType;
  value: string;
}

const TermOverridesSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const tagPrompt = unitConfig?.config?.tagPrompt;
  const [warnings, setWarnings] = useState<ConflictWarning[]>([]);

  const formDefaults: TermOverrideFormInputs = useMemo(() => {
    const termOverrides = unitConfig?.config?.termOverrides ?? {};
    const overrides: Record<string, string> = {};

    TERM_METADATA.forEach(term => {
      overrides[term.key] = termOverrides[term.key] ?? "";
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

  const checkConflicts = (overrides: Record<string, string>): ConflictWarning[] => {
    const conflicts: ConflictWarning[] = [];

    TERM_METADATA.forEach(term => {
      const value = overrides[term.key]?.trim();
      if (!value) return;

      // Check if value conflicts with another term's key or default
      // (excluding this term's own key and default)
      TERM_METADATA.forEach(otherTerm => {
        if (otherTerm.key === term.key) return;

        if (value === otherTerm.key) {
          conflicts.push({
            conflictsWith: `the "${otherTerm.key}" term key`,
            termKey: term.key,
            value
          });
        } else if (value === otherTerm.defaultValue && otherTerm.defaultValue) {
          conflicts.push({
            conflictsWith: `the default value for "${otherTerm.key}"`,
            termKey: term.key,
            value
          });
        }
      });
    });

    return conflicts;
  };

  const onSubmit: SubmitHandler<TermOverrideFormInputs> = (data) => {
    // Check for conflicts. Prevent saving if conflicts exist.
    const conflicts = checkConflicts(data.overrides);
    setWarnings(conflicts);

    if (conflicts.length > 0) {
      return;
    }

    setUnitConfig(draft => {
      if (!draft) return;

      const termOverrides: Record<string, string> = {};

      TERM_METADATA.forEach(term => {
        const value = data.overrides[term.key]?.trim();
        // Only save if value is non-empty and differs from the default
        if (value && value !== term.defaultValue) {
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
    const term = TERM_METADATA.find(t => t.key === termKey);
    if (!term) return "";

    // Strategy has special fallback to tagPrompt
    if (termKey === "Strategy" && !term.defaultValue) {
      return tagPrompt || "(no default)";
    }

    return term.defaultValue || "(no default)";
  };

  const hasWarningForTerm = (termKey: TranslationKeyType): ConflictWarning | undefined => {
    return warnings.find(w => w.termKey === termKey);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="term-overrides-settings">
      <h3 id="term-overrides-heading">Term Overrides</h3>
      <p className="muted" id="term-overrides-description">
        Configure customized terminology. These overrides will replace the default terms in the CLUE app everywhere
        the terms appear.
      </p>

      {warnings.length > 0 && (
        <div className="warnings" role="alert">
          <strong>Warning:</strong> Some overrides conflict with default terms and could cause problems:
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>
                &quot;{warning.value}&quot; for {warning.termKey} conflicts with {warning.conflictsWith}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="term-list">
        {[...TERM_METADATA].sort((a, b) => a.key.localeCompare(b.key)).map(term => {
          const termWarning = hasWarningForTerm(term.key);
          const effectiveDefault = getEffectiveDefault(term.key);

          return (
            <div key={term.key} className={`term-item ${termWarning ? "has-warning" : ""}`}>
              <div className="term-header">
                <label htmlFor={`override-${term.key}`} className="term-label">
                  {term.key}
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
                  {...register(`overrides.${term.key}` as const)}
                />
              </div>
              {term.key === "Strategy" && (
                <p className="help-text muted small">
                  If left blank, defaults to the tag prompt from curriculum configuration
                  {tagPrompt ? ` ("${tagPrompt}")` : " (not set)"}.
                </p>
              )}
              {termWarning && (
                <p className="warning-text">
                  This value conflicts with {termWarning.conflictsWith}
                </p>
              )}
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

export default TermOverridesSettings;
