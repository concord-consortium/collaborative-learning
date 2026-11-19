import React from "react";
import { AiContextToken, kAiContextTokens, kDefaultTokens } from "../../../shared/ai-context-tokens";
import "./ai-context-vocabulary-help.scss";

const kTokenHelp: Record<AiContextToken, string> = {
  curriculum: "the unit's curriculum around the current problem",
  problem: "the current problem and how it asks students to work",
  classwork: "all student work in this class, including this student's own",
  teacherwork: "the teacher's materials, as reference",
  mywork: "the document the student is working in",
};

interface IProps {
  /** Open on load. Set where the form has room; leave closed inside a tile, where five items
   * expanded would push the prompt itself out of view. */
  defaultOpen?: boolean;
}

/**
 * What an author may name in a prompt. Rendered from the vocabulary itself, so a token added to
 * the shared module cannot leave this list behind.
 */
export function AiContextVocabularyHelp({ defaultOpen }: IProps = {}) {
  const defaults = kDefaultTokens.map(token => `{{${token}}}`).join(" and ");
  return (
    <details className="ai-context-vocabulary-help" open={defaultOpen}>
      <summary>What can this prompt reference?</summary>
      <p>Name the context this prompt should work with:</p>
      <ul>
        {kAiContextTokens.map(token => (
          <li key={token}>
            <code>{`{{${token}}}`}</code> — {kTokenHelp[token]}
          </li>
        ))}
      </ul>
      <p>A prompt naming none of these uses {defaults}.</p>
    </details>
  );
}
