import React, { useCallback } from "react";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import { useDocumentComments, usePostDocumentComment } from "../../hooks/document-comment-hooks";
import "./chat-panel.scss";

interface IProps {
  activeNavTab: string;
  document: any;
  onCloseChatPanel:(show:boolean) => void;
}

export const ChatPanel: React.FC<IProps> = ({ activeNavTab, document, onCloseChatPanel }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isLoading, data: comments } = useDocumentComments(document.key);
  const postCommentMutation = usePostDocumentComment();
  const postComment = useCallback((comment: string) => postCommentMutation.mutate({ document, comment }),
                                  [document, postCommentMutation]);
  const newCommentCount = 8;  // TODO: figure this out

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
