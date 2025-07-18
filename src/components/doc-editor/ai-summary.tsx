import { observer } from "mobx-react";
import React from "react";

import "./ai-summary.scss";

interface Props {
  summary: string;
  toggleAiSummary(): void
}

export const AiSummary = observer(function AiSummary({ summary, toggleAiSummary }: Props) {

  const handleClose = () => {
    toggleAiSummary();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary)
      .then(() => {
        alert("AI Summary copied to clipboard");
      })
      .catch((error) => {
        alert("Failed to copy AI summary: " + error);
      });
  };

  return (
    <div className="aiSummary">
      <div className="header">
        <h2>AI Summary</h2>
        <div>
          <button onClick={handleCopy}>Copy</button>
          <button onClick={handleClose}>X</button>

        </div>
      </div>
      <div className="content">
        <p>{summary}</p>
      </div>
    </div>
  );
});
