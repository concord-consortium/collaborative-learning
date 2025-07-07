import React from "react";
import { observer } from "mobx-react";
import { DocumentContentModelType } from "../../models/document/document-content";
import { kAnalyzerUserParams } from "../../models/stores/user-types";

import AdaAvatar from "../../assets/ada-avatar.svg";

const message = "Ada is evaluating...";
const userName = kAnalyzerUserParams.fullName;

interface IWaitingMessageProps {
  content?: DocumentContentModelType;
}

/**
 * Displays a styled waiting message if content.awaitingAIAnalysis is true.
 */
const WaitingMessage: React.FC<IWaitingMessageProps> = ({ content }) => {
  if (!content?.awaitingAIAnalysis) return null;

  return (
    <div className="comment-thread">
      <div className="comment-text-header">
        <AdaAvatar />
        <div className="user-name">{userName}</div>
      </div>
      <div className="comment-text" data-testid="comment">
        <em>{message}</em>
      </div>
    </div>
  );
};

export default observer(WaitingMessage);
