import React, { useEffect, useRef } from "react";
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
const _WaitingMessage: React.FC<IWaitingMessageProps> = ({ content }) => {

  const waitingMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (waitingMessageRef.current && content?.awaitingAIAnalysis) {
      waitingMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content?.awaitingAIAnalysis]);

  const body = (
    <>
      <div className="comment-text-header">
        <AdaAvatar />
        <div className="user-name">{userName}</div>
      </div>
      <div className="comment-text" data-testid="comment">
        <em>{message}</em>
      </div>
    </>);

  return (
    <div className="comment-thread" ref={waitingMessageRef}>
      {content?.awaitingAIAnalysis && body}
    </div>
  );
};

export default observer(_WaitingMessage);
