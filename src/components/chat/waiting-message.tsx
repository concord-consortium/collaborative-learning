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
 * Ada's avatar, name, and an italic status line. The presentation shared by the "Ada is
 * thinking about it..." waiting bubble and the empty-document nudge — the two decide separately
 * *whether* to show (WaitingMessage and EmptyDocumentNudge below), this only renders *what*.
 */
export const AdaStatusMessage: React.FC<IAdaStatusMessageProps> = ({ message }) => (
  <>
    <div className="comment-text-header">
      <ChatAvatar uid={kAnalyzerUserParams.id} pulse />
      <div className="user-name">{userName}</div>
    </div>
    <div className="comment-text" data-testid="comment">
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

interface IEmptyDocumentNudgeProps {
  content?: DocumentContentModelType;
}

/**
 * Displays the "add some work" nudge in place of a real Ideas request when the document is
 * empty. A distinct condition from WaitingMessage's `isAwaitingRemoteComment` — the two can both
 * be true at once (see comment-card.tsx) and are never folded together.
 *
 * Renders nothing at all (not even an empty wrapper) when there is no nudge: comment-card.tsx
 * renders this next to WaitingMessage, whose own wrapper always renders per its existing
 * behavior, and a second empty `.comment-thread` div would double that div's bottom margin on
 * every comment card, nudge or not.
 */
const _EmptyDocumentNudge: React.FC<IEmptyDocumentNudgeProps> = ({ content }) => {

  const nudgeRef = useRef<HTMLDivElement>(null);
  const nudge = content?.emptyDocumentNudge;

  useEffect(() => {
    if (nudgeRef.current && nudge) {
      nudgeRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [nudge]);

  if (!nudge) return null;

  return (
    <div className="comment-thread" ref={nudgeRef}>
      <AdaStatusMessage message={nudge.message} />
    </div>
  );
};

export const EmptyDocumentNudge = observer(_EmptyDocumentNudge);
