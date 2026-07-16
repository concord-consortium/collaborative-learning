import React, { useEffect, useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useCurriculum } from "../../hooks/use-curriculum";
import { ISettings } from "../../types";

interface DocumentSettingsFormInputs {
  defaultSharedDocuments: boolean;
  showTextTitles: boolean;
}

const DocumentSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();

  const formDefaults: DocumentSettingsFormInputs = useMemo(() => {
    return {
      defaultSharedDocuments: unitConfig?.config?.defaultSharedDocuments ?? false,
      // Titles are shown only when the unit explicitly opts in with text.hideTitle: false.
      showTextTitles: unitConfig?.config?.settings?.text?.hideTitle === false,
    };
  }, [unitConfig]);

  const { handleSubmit, register, reset } = useForm<DocumentSettingsFormInputs>({
    defaultValues: formDefaults,
  });

  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  const onSubmit: SubmitHandler<DocumentSettingsFormInputs> = (data) => {
    setUnitConfig(draft => {
      if (!draft) return;
      if (data.defaultSharedDocuments) {
        draft.config.defaultSharedDocuments = true;
      } else {
        delete draft.config.defaultSharedDocuments;
      }
      if (data.showTextTitles) {
        if (!draft.config.settings) draft.config.settings = {} as ISettings;
        if (!draft.config.settings.text) draft.config.settings.text = {};
        draft.config.settings.text.hideTitle = false;
      } else {
        // Remove the override so the tile inherits the default (title hidden).
        delete draft.config.settings?.text?.hideTitle;
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="document-settings">
      <h3>Document Settings</h3>
      <p className="muted">
        Configure default behavior for student documents in this unit.
      </p>

      <fieldset>
        <legend>Default Sharing</legend>
        <label className="horizontal middle">
          <input
            type="checkbox"
            {...register("defaultSharedDocuments")}
          />
          <span>Share student documents by default</span>
        </label>
        <p className="muted small">
          When enabled, new student documents (problem, personal, and learning log)
          will be shared with classmates by default instead of being private.
        </p>
      </fieldset>

      <fieldset>
        <legend>Text Tile Titles</legend>
        <label className="horizontal middle">
          <input
            type="checkbox"
            {...register("showTextTitles")}
          />
          <span>Show titles on text tiles</span>
        </label>
        <p className="muted small">
          When enabled, text tiles display their (auto-numbered) titles like other tiles, so they
          can be named and referred to by name. Leave off (the default) for units not authored with
          text-tile titles in mind.
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

export default DocumentSettings;
