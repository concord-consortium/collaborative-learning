import React, { useEffect, useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";

import { useCurriculum } from "../../hooks/use-curriculum";
import { escapeKeyForForm, TERM_METADATA, TranslationKeyType } from "../../../utilities/translation/translation-types";
import { getDefaultValue } from "../../../utilities/translation/translate";

import "./term-overrides-settings.scss";

interface TermOverrideFormInputs {
  overrides: Record<string, string>;
}

export const TermOverridesSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const tagPrompt = unitConfig?.config?.tagPrompt;

  const formDefaults: TermOverrideFormInputs = useMemo(() => {
    const termOverrides = unitConfig?.config?.termOverrides ?? {};
    const overrides: Record<string, string> = {};

    TERM_METADATA.forEach(term => {
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

      TERM_METADATA.forEach(term => {
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
    const defaultVal = getDefaultValue(termKey);

    // Strategy has special fallback to tagPrompt
    if (termKey === "Strategy" && !defaultVal) {
      return tagPrompt || "(no default)";
    }

    return defaultVal || "(no default)";
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="term-overrides-settings">
      <h3 id="term-overrides-heading">Term Overrides</h3>
      <p className="muted" id="term-overrides-description">
        Configure customized terminology. These overrides will replace the default terms in the CLUE app everywhere
        the terms appear.
      </p>

      <div className="term-list">
        {[...TERM_METADATA].sort((a, b) => a.key.localeCompare(b.key)).map(term => {
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
              {term.key === "Strategy" && (
                <p className="help-text muted small">
                  If left blank, defaults to the tag prompt from curriculum configuration
                  {tagPrompt ? ` ("${tagPrompt}")` : " (not set)"}.
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
