import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { DocumentContentModelType } from "../../models/document/document-content";
import { kAnalyzerUserParams } from "../../../shared/shared";
import ChatAvatar from "./chat-avatar";

const waitingMessageText = "Ada is thinking about it...";
const userName = kAnalyzerUserParams.fullName;

interface IAdaStatusMessageProps {
  message: string;
}

/**
 * Ada's avatar, name, and a status line — shared presentation for WaitingMessage and StatusMessage
 * below, which each decide separately whether to show it.
 */
export const AdaStatusMessage: React.FC<IAdaStatusMessageProps> = ({ message }) => (
  <>
    <div className="comment-text-header">
      <ChatAvatar uid={kAnalyzerUserParams.id} pulse />
      <div className="user-name">{userName}</div>
    </div>
    <div className="comment-text" data-testid="comment" role="status" aria-live="polite">
      <em>{message}</em>
    </div>
  </>
);

interface IWaitingMessageProps {
  content?: DocumentContentModelType;
}

/**
 * Displays a styled waiting message if AI analysis is pending.
 */
const _WaitingMessage: React.FC<IWaitingMessageProps> = ({ content }) => {

  const waitingMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (waitingMessageRef.current && content?.isAwaitingRemoteComment) {
      waitingMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content?.isAwaitingRemoteComment]);

  return (
    <div className="comment-thread" ref={waitingMessageRef}>
      {content?.isAwaitingRemoteComment && <AdaStatusMessage message={waitingMessageText} />}
    </div>
  );
};

export default observer(_WaitingMessage);

interface IStatusMessageProps {
  content?: DocumentContentModelType;
}

/**
 * Displays the document's status message (empty-document nudge, or a failure message). Distinct
 * from WaitingMessage's `isAwaitingRemoteComment` — both can be true at once.
 *
 * Renders nothing, not even an empty wrapper, when there's no message: comment-card.tsx renders
 * this beside WaitingMessage's own always-present wrapper, and a second empty div would double
 * the margin on every comment card.
 */
const _StatusMessage: React.FC<IStatusMessageProps> = ({ content }) => {

  const messageRef = useRef<HTMLDivElement>(null);
  const status = content?.statusMessage;

  useEffect(() => {
    if (messageRef.current && status) {
      messageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status]);

  if (!status) return null;

  return (
    <div className="comment-thread" ref={messageRef}>
      <AdaStatusMessage message={status.message} />
    </div>
  );
};

export const StatusMessage = observer(_StatusMessage);
