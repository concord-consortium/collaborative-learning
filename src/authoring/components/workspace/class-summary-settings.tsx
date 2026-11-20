import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { CLASS_SUMMARY_STUDENT_INSTRUCTION } from "../../../../shared/class-summary-prompts";
import { useCurriculum } from "../../hooks/use-curriculum";

interface ClassSummarySettingsFormInputs {
  replaceStudentPrompt: string;
  appendToStudentPrompt: string;
}

const ClassSummarySettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimeoutRef.current);
  }, []);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(CLASS_SUMMARY_STUDENT_INSTRUCTION).then(() => {
      setCopied(true);
      window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const formDefaults: ClassSummarySettingsFormInputs = useMemo(() => {
    const classSummaryPrompts = unitConfig?.config?.classSummaryPrompts;
    return {
      replaceStudentPrompt: classSummaryPrompts?.replaceStudentPrompt ?? "",
      appendToStudentPrompt: classSummaryPrompts?.appendToStudentPrompt ?? "",
    };
  }, [unitConfig]);

  const { handleSubmit, register, reset } = useForm<ClassSummarySettingsFormInputs>({
    defaultValues: formDefaults,
  });

  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  const onSubmit: SubmitHandler<ClassSummarySettingsFormInputs> = (data) => {
    const replaceStudentPrompt = data.replaceStudentPrompt.trim();
    const appendToStudentPrompt = data.appendToStudentPrompt.trim();
    setUnitConfig(draft => {
      if (!draft) return;
      if (!replaceStudentPrompt && !appendToStudentPrompt) {
        delete draft.config.classSummaryPrompts;
        return;
      }
      draft.config.classSummaryPrompts = {
        ...(replaceStudentPrompt ? { replaceStudentPrompt } : {}),
        ...(appendToStudentPrompt ? { appendToStudentPrompt } : {}),
      };
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="class-summary-settings">
      <h3>Class Summary</h3>
      <p className="muted">
        Optional per-unit overrides of the prompt behind the Class Summary a teacher sees in the
        Sort Work tab. They steer the summary of student work only — the summary of teacher work
        keeps its built-in prompt. A problem can override the unit with its own wording on the
        problem&apos;s Container Configuration page.
      </p>
      <p className="muted">Three things to know before you iterate here:</p>
      <ul className="muted iterationNotes">
        <li>
          The summary is written by a server that reads the{" "}
          <strong>published unit on the main branch</strong>, so a change has no effect on a branch
          preview.
        </li>
        <li>The server caches a unit for about ten minutes.</li>
        <li>A summary that has already been written is not redone, so a class that has one keeps it.</li>
      </ul>

      <details className="builtInPrompt">
        <summary>View built-in summary prompt</summary>
        <p className="muted small">
          This is the prompt the overrides below act on. A replaced prompt is frozen — it won&apos;t
          pick up future improvements to this built-in text — while an appended prompt inherits them.
        </p>
        <button type="button" onClick={handleCopyPrompt}>
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
        <pre>{CLASS_SUMMARY_STUDENT_INSTRUCTION}</pre>
      </details>

      <fieldset>
        <label htmlFor="replaceStudentPrompt">Replace built-in summary prompt</label>
        <textarea id="replaceStudentPrompt" rows={8} {...register("replaceStudentPrompt")} />
        <p className="muted small">
          Leave blank to keep the built-in prompt. A replacement applies to each block of student
          work, but not to the step that merges those summaries for a large class — so a replacement
          that changes the shape of the answer (a table, a numbered list) may not survive that merge.
          Prefer the additional prompt below unless you need full control.
        </p>
      </fieldset>

      <fieldset>
        <label htmlFor="appendToStudentPrompt">Additional summary prompt (appended)</label>
        <textarea id="appendToStudentPrompt" rows={6} {...register("appendToStudentPrompt")} />
        <p className="muted small">
          Appended after the summary prompt (built-in or replaced above). This one is also applied
          when a large class&apos;s partial summaries are merged, so it holds for the whole summary.
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

export default ClassSummarySettings;
