import React, { useEffect, useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useCurriculum } from "../../hooks/use-curriculum";
import { ISettings, IUnitConfig } from "../../types";
import { buildSectionDividerTemplate } from "../../utils/template-utils";

interface DocumentSettingsFormInputs {
  defaultSharedDocuments: boolean;
  showShare: boolean;
  show4up: boolean;
  showTextTitles: boolean;
  documentTemplateEnabled: boolean;
  planningTemplateEnabled: boolean;
  defaultDocumentType: NonNullable<IUnitConfig["defaultDocumentType"]>;
  groupDocumentsEnabled: boolean;
}

const DocumentSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const config = unitConfig?.config;

  const hasDocumentTemplate = !!config?.defaultDocumentTemplate;
  const hasPlanningTemplate = !!config?.planningTemplate;
  const groupDocDisabledByAutoAssign = !!config?.autoAssignStudentsToIndividualGroups;

  const formDefaults: DocumentSettingsFormInputs = useMemo(() => {
    return {
      defaultSharedDocuments: config?.defaultSharedDocuments ?? false,
      showShare: config?.showShare ?? true,
      // hide4up defaults false, so the 4-up button shows by default.
      show4up: !config?.hide4up,
      // Titles are shown only when the unit explicitly opts in with text.hideTitle: false.
      showTextTitles: config?.settings?.text?.hideTitle === false,
      // Default to on when a legacy template already exists (flag undefined → applied at runtime).
      documentTemplateEnabled: config?.defaultDocumentTemplateEnabled ?? hasDocumentTemplate,
      planningTemplateEnabled: config?.planningTemplateEnabled ?? hasPlanningTemplate,
      defaultDocumentType: config?.defaultDocumentType ?? "problem",
      // "group" implies group documents even without the explicit flag (mirrors documentTemplateEnabled above).
      groupDocumentsEnabled: config?.groupDocumentsEnabled ?? config?.defaultDocumentType === "group",
    };
  }, [config, hasDocumentTemplate, hasPlanningTemplate]);

  const { handleSubmit, register, reset, watch, setValue } = useForm<DocumentSettingsFormInputs>({
    defaultValues: formDefaults,
  });

  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  const groupDocSelected = watch("defaultDocumentType") === "group";

  // "Group doc" means group docs on: drive the checkbox so the display matches what Save will write,
  // including visibly repairing a contradictory saved "group" + explicit false.
  useEffect(() => {
    if (groupDocSelected) setValue("groupDocumentsEnabled", true);
  }, [groupDocSelected, setValue]);

  const onSubmit: SubmitHandler<DocumentSettingsFormInputs> = (data) => {
    setUnitConfig(draft => {
      if (!draft) return;
      if (data.defaultSharedDocuments) {
        draft.config.defaultSharedDocuments = true;
      } else {
        delete draft.config.defaultSharedDocuments;
      }
      // Default is true (button shown); only persist the non-default (hidden) so config stays minimal.
      if (data.showShare) {
        delete draft.config.showShare;
      } else {
        draft.config.showShare = false;
      }
      // Inverse of the showShare pattern: hide4up defaults false, so store true only to hide the button.
      if (data.show4up) {
        delete draft.config.hide4up;
      } else {
        draft.config.hide4up = true;
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
      // Seed a fresh document template with a section divider per unit section so the author just fills
      // each section (only when first enabling and no content exists yet).
      if (data.documentTemplateEnabled && !draft.config.defaultDocumentTemplate) {
        draft.config.defaultDocumentTemplate = buildSectionDividerTemplate(Object.keys(draft.sections ?? {}));
      }
      draft.config.planningTemplateEnabled = data.planningTemplateEnabled;
      // Omit-the-default: "problem" is implicit, so only persist the other two choices.
      if (data.defaultDocumentType !== "problem") {
        draft.config.defaultDocumentType = data.defaultDocumentType;
      } else {
        delete draft.config.defaultDocumentType;
      }
      // Omit-the-default: write true only when on, delete otherwise. The `=== "group"` arm is
      // defense in case submit races the driving effect above; by product decision, selecting
      // "Group doc" always means group docs on.
      if (data.defaultDocumentType === "group" || data.groupDocumentsEnabled) {
        draft.config.groupDocumentsEnabled = true;
      } else {
        delete draft.config.groupDocumentsEnabled;
      }
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
        <legend>Share Button</legend>
        <label className="horizontal middle">
          <input
            type="checkbox"
            {...register("showShare")}
          />
          <span>Show the share button on student documents</span>
        </label>
        <p className="muted small">
          When enabled (the default), students see the share/unshare toggle on their documents. Turn it
          off to hide sharing for this unit.
        </p>
      </fieldset>

      <fieldset>
        <legend>4-up View</legend>
        <label className="horizontal middle">
          <input
            type="checkbox"
            {...register("show4up")}
          />
          <span>Show the 4-up view button</span>
        </label>
        <p className="muted small">
          When enabled (the default), students see the button to switch to the 4-up group view. Turn it
          off to hide it for this unit.
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

      <fieldset>
        <legend>Starting Document</legend>
        <select
          aria-label="Starting document"
          aria-describedby="default-document-type-description"
          {...register("defaultDocumentType")}
        >
          <option value="problem">Problem doc</option>
          <option value="personal">Personal doc</option>
          <option value="group" disabled={groupDocDisabledByAutoAssign}>Group doc</option>
        </select>
        <p className="muted small" id="default-document-type-description">
          Which document students start in. &quot;Group doc&quot; also enables group documents for
          the unit (each group&apos;s document is auto-created and appears in Sort Work). When Group
          doc is selected, teachers start in the problem document instead.
          {groupDocDisabledByAutoAssign &&
            " This unit auto-assigns students to individual groups, which disables group documents."}
        </p>
        <label className="horizontal middle">
          <input
            type="checkbox"
            {...register("groupDocumentsEnabled")}
            disabled={groupDocSelected}
          />
          <span>Enable group documents</span>
        </label>
        <p className="muted small">
          Group documents are auto-created per group and appear in Sort Work, independent of which
          document students start in.
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
