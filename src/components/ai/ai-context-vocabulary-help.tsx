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

/**
 * What an author may name in a prompt. Rendered from the vocabulary itself, so a token added to
 * the shared module cannot leave this list behind. Collapsed by default: it sits inside a tile,
 * where five items expanded would push the prompt itself out of view.
 */
export function AiContextVocabularyHelp() {
  const defaults = kDefaultTokens.map(token => `{{${token}}}`).join(" and ");
  return (
    <details className="ai-context-vocabulary-help">
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
