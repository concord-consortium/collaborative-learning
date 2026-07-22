import React, { useEffect, useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useCurriculum } from "../../hooks/use-curriculum";
import { ISettings } from "../../types";

interface DocumentSettingsFormInputs {
  defaultSharedDocuments: boolean;
  showTextTitles: boolean;
  documentTemplateEnabled: boolean;
  planningTemplateEnabled: boolean;
}

const DocumentSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const config = unitConfig?.config;

  const hasDocumentTemplate = !!config?.defaultDocumentTemplate;
  const hasPlanningTemplate = !!config?.planningTemplate;

  const formDefaults: DocumentSettingsFormInputs = useMemo(() => {
    return {
      defaultSharedDocuments: config?.defaultSharedDocuments ?? false,
      // Titles are shown only when the unit explicitly opts in with text.hideTitle: false.
      showTextTitles: config?.settings?.text?.hideTitle === false,
      // Default to on when a legacy template already exists (flag undefined → applied at runtime).
      documentTemplateEnabled: config?.defaultDocumentTemplateEnabled ?? hasDocumentTemplate,
      planningTemplateEnabled: config?.planningTemplateEnabled ?? hasPlanningTemplate,
    };
  }, [config, hasDocumentTemplate, hasPlanningTemplate]);

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
      // Non-destructive template switches (like aiEvaluation gates the persistent aiPrompt): these flip
      // the enable flag only; the authored template content is untouched. Content is removed by "Delete".
      draft.config.defaultDocumentTemplateEnabled = data.documentTemplateEnabled;
      draft.config.planningTemplateEnabled = data.planningTemplateEnabled;
    });
  };

  const deleteDocumentTemplate = () => {
    if (!window.confirm("Delete the unit document template and its content? This cannot be undone.")) return;
    setUnitConfig(draft => {
      if (!draft) return;
      delete draft.config.defaultDocumentTemplate;
      delete draft.config.defaultDocumentTemplateEnabled;
    });
  };

  const deletePlanningTemplate = () => {
    if (!window.confirm("Delete the unit planning template and its content? This cannot be undone.")) return;
    setUnitConfig(draft => {
      if (!draft) return;
      delete draft.config.planningTemplate;
      delete draft.config.planningTemplateEnabled;
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

      <fieldset>
        <legend>Templates</legend>
        <p className="muted small">
          Templates preload content into a new document the first time a user creates it. Enable a template
          to edit it on its own page in the nav; disabling keeps the content but stops it being applied.
        </p>
        <label className="horizontal middle">
          <input type="checkbox" {...register("documentTemplateEnabled")} />
          <span>Enable the document template</span>
        </label>
        <p className="muted small">
          Preloads a problem document (when not auto-sectioned) and personal documents for this unit.
          {hasDocumentTemplate &&
            <> <button type="button" className="danger" onClick={deleteDocumentTemplate}>Delete</button></>}
        </p>
        <label className="horizontal middle">
          <input type="checkbox" {...register("planningTemplateEnabled")} />
          <span>Enable the planning template</span>
        </label>
        <p className="muted small">
          Preloads the teacher planning document, one template per planning section.
          {hasPlanningTemplate &&
            <> <button type="button" className="danger" onClick={deletePlanningTemplate}>Delete</button></>}
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
