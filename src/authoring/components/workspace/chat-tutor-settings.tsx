import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { CHAT_GENERIC_PROMPT } from "../../../../shared/chat-tutor-generic-prompt";
import { CHAT_TUTOR_DEFAULT_INTRO } from "../../../../shared/chat-tutor-default-intro";
import { useCurriculum } from "../../hooks/use-curriculum";

interface ChatTutorSettingsFormInputs {
  chatTutorEnabled: boolean;
  chatTutorIntro: string;
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
    const config = unitConfig?.config;
    const chatTutorPrompts = config?.chatTutorPrompts;
    return {
      chatTutorEnabled: config?.chatTutorEnabled ?? false,
      chatTutorIntro: config?.chatTutorIntro ?? CHAT_TUTOR_DEFAULT_INTRO,
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
    const chatTutorIntro = data.chatTutorIntro.trim();
    setUnitConfig(draft => {
      if (!draft) return;
      // Write the enable flag explicitly (rather than deleting on uncheck): config merges bottom-up
      // and take the first non-null value (problem → investigation → unit → defaults), so a stored
      // `false` correctly overrides a `true` set at a higher level, whereas a deleted key would let
      // that higher-level `true` win. Independent of the prompt overrides — toggling never discards them.
      draft.config.chatTutorEnabled = data.chatTutorEnabled;
      // Intro: storing the built-in default as "unset" (delete) lets units inherit future default
      // changes; any other value is stored — including an empty string, which suppresses the intro.
      if (chatTutorIntro === CHAT_TUTOR_DEFAULT_INTRO) {
        delete draft.config.chatTutorIntro;
      } else {
        draft.config.chatTutorIntro = chatTutorIntro;
      }
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

      <fieldset className="enableChatTutor">
        <label>
          <input type="checkbox" {...register("chatTutorEnabled")} />
          Enable the AI chat tutor for students in this unit
        </label>
        <p className="muted small">
          When off, the prompt overrides below are still kept, and the <code>chatTutor</code> URL
          param can be used to preview the tutor.
        </p>
      </fieldset>

      <fieldset className="chatTutorIntro">
        <label htmlFor="chatTutorIntro">Chat intro message</label>
        <textarea id="chatTutorIntro" rows={4} {...register("chatTutorIntro")} />
        <p className="muted small">
          Shown at the top of the chat column when a student opens the tutor. It is display-only —
          never sent to the AI as context, so a name or claim you write here is not known to the tutor.
          Leave it as the default to inherit the built-in greeting, or clear it to show no intro.
        </p>
      </fieldset>

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
