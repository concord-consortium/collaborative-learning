import React, { useCallback } from "react";
import { UserModelType } from "../../models/stores/user";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import {
  useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDocumentOrCurriculumMetadata } from "../../hooks/use-stores";
import "./chat-panel.scss";

interface IProps {
  user?: UserModelType;
  activeNavTab: string;
  documentKey?: string;
  onCloseChatPanel:(show:boolean) => void;
}

export const ChatPanel: React.FC<IProps> = ({ user, activeNavTab, documentKey, onCloseChatPanel }) => {
  const document = useDocumentOrCurriculumMetadata(documentKey);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isLoading, data: comments } = useDocumentComments(documentKey);
  const { data: unreadComments } = useUnreadDocumentComments(documentKey);
  const postCommentMutation = usePostDocumentComment();
  const postComment = useCallback((comment: string) => {
    return document
            ? postCommentMutation.mutate({ document, comment: { content: comment } })
            : undefined;
  }, [document, postCommentMutation]);
  const newCommentCount = unreadComments?.length || 0;

  return (
    <div className={`chat-panel ${activeNavTab}`} data-testid="chat-panel">
      <ChatPanelHeader activeNavTab={activeNavTab} newCommentCount={newCommentCount}
                       onCloseChatPanel={onCloseChatPanel} />
      {((activeNavTab !=="my-work") || document?.key)
        ? <CommentCard
            user={user}
            activeNavTab={activeNavTab}
            onPostComment={postComment}
            postedComments={comments}
          />
        : <div className="select-doc-instruction">Open a document to begin or view comment threads</div>
      }
    </div>
  );
};
