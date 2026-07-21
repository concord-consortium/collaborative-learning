import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { CHAT_GENERIC_PROMPT } from "../../../../shared/chat-tutor-generic-prompt";
import { useCurriculum } from "../../hooks/use-curriculum";

interface ChatTutorSettingsFormInputs {
  replaceGenericPrompt: string;
  appendToGenericPrompt: string;
}

const ChatTutorSettings: React.FC = () => {
  const { unitConfig, setUnitConfig, saveState } = useCurriculum();
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimeoutRef.current);
  }, []);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(CHAT_GENERIC_PROMPT).then(() => {
      setCopied(true);
      window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const formDefaults: ChatTutorSettingsFormInputs = useMemo(() => {
    const chatTutorPrompts = unitConfig?.config?.chatTutorPrompts;
    return {
      replaceGenericPrompt: chatTutorPrompts?.replaceGenericPrompt ?? "",
      appendToGenericPrompt: chatTutorPrompts?.appendToGenericPrompt ?? "",
    };
  }, [unitConfig]);

  const { handleSubmit, register, reset } = useForm<ChatTutorSettingsFormInputs>({
    defaultValues: formDefaults,
  });

  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  const onSubmit: SubmitHandler<ChatTutorSettingsFormInputs> = (data) => {
    const replaceGenericPrompt = data.replaceGenericPrompt.trim();
    const appendToGenericPrompt = data.appendToGenericPrompt.trim();
    setUnitConfig(draft => {
      if (!draft) return;
      if (!replaceGenericPrompt && !appendToGenericPrompt) {
        delete draft.config.chatTutorPrompts;
        return;
      }
      draft.config.chatTutorPrompts = {
        ...(replaceGenericPrompt ? { replaceGenericPrompt } : {}),
        ...(appendToGenericPrompt ? { appendToGenericPrompt } : {}),
      };
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="chat-tutor-settings">
      <h3>Chat Tutor</h3>
      <p className="muted">
        Optional per-unit overrides of the AI chat tutor&apos;s built-in generic prompt.
        Saving a change starts a fresh tutor conversation the next time a preview or
        student session sends a message; reverting to a previously used prompt resumes
        that version&apos;s earlier conversation. To try the tutor from a preview, add
        the <code>chatTutor</code> parameter to this authoring page&apos;s URL before
        opening a student preview (preview links inherit it).
      </p>

      <details className="builtInPrompt">
        <summary>View built-in tutor prompt</summary>
        <p className="muted small">
          This is the prompt the overrides below act on. A replaced prompt is frozen —
          it won&apos;t pick up future improvements to this built-in text — while an
          appended prompt inherits them.
        </p>
        <button type="button" onClick={handleCopyPrompt}>
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
        <pre>{CHAT_GENERIC_PROMPT}</pre>
      </details>

      <fieldset>
        <label htmlFor="replaceGenericPrompt">Replace built-in tutor prompt</label>
        <textarea id="replaceGenericPrompt" rows={12} {...register("replaceGenericPrompt")} />
        <p className="muted small">
          Leave blank to keep the built-in prompt. A full replacement removes ALL built-in
          behavior — including the never-reveal-answers rule, the treat-context-as-data
          injection guard, and the rule that the workspace summary with the highest seq
          supersedes earlier ones. Prefer the additional prompt below unless you need
          full control.
        </p>
      </fieldset>

      <fieldset>
        <label htmlFor="appendToGenericPrompt">Additional tutor prompt (appended)</label>
        <textarea id="appendToGenericPrompt" rows={8} {...register("appendToGenericPrompt")} />
        <p className="muted small">
          Appended after the generic prompt (built-in or replaced above) to customize the
          tutor for this unit.
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

export default ChatTutorSettings;
