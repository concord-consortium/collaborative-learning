import React, { useCallback } from "react";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import {
  useDocumentComments, usePostDocumentComment, useUnreadDocumentComments
} from "../../hooks/document-comment-hooks";
import { useDocumentOrCurriculumMetadata } from "../../hooks/use-stores";
import "./chat-panel.scss";

interface IProps {
  activeNavTab: string;
  documentKey?: string;
  onCloseChatPanel:(show:boolean) => void;
}

export const ChatPanel: React.FC<IProps> = ({ activeNavTab, documentKey, onCloseChatPanel }) => {
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
      <CommentCard
        activeNavTab={activeNavTab}
        onPostComment={postComment}
        postedComments={comments}
      />
    </div>
  );
};
