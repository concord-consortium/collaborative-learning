import React, { useEffect, useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useCurriculum } from "../../hooks/use-curriculum";

const kDefaultDrivingQuestionBoardTitle = "Driving Question Board";

interface DocumentSettingsFormInputs {
  defaultSharedDocuments: boolean;
  drivingQuestionBoardTitle: string;
}

const DocumentSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();

  const formDefaults: DocumentSettingsFormInputs = useMemo(() => {
    return {
      defaultSharedDocuments: unitConfig?.config?.defaultSharedDocuments ?? false,
      drivingQuestionBoardTitle:
        unitConfig?.config?.drivingQuestionBoardTitle ?? kDefaultDrivingQuestionBoardTitle,
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
      const dqbTitle = data.drivingQuestionBoardTitle?.trim();
      if (dqbTitle && dqbTitle !== kDefaultDrivingQuestionBoardTitle) {
        draft.config.drivingQuestionBoardTitle = dqbTitle;
      } else {
        delete draft.config.drivingQuestionBoardTitle;
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
        <legend>Driving Question Board</legend>
        <label className="vertical">
          <span>Title</span>
          <input
            type="text"
            placeholder={kDefaultDrivingQuestionBoardTitle}
            {...register("drivingQuestionBoardTitle")}
          />
        </label>
        <p className="muted small">
          When group documents are enabled, a single class-wide board is created per unit
          for the whole class to contribute to (driving questions, word walls, and other
          shared artifacts). This sets its title.
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
