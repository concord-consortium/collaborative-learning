import React, { useCallback } from "react";
import { ChatPanelHeader } from "./chat-panel-header";
import { CommentCard } from "./comment-card";
import { useDocumentComments, usePostDocumentComment } from "../../hooks/document-comment-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import "./chat-panel.scss";

interface IProps {
  activeNavTab: string;
  document: any;
  onCloseChatPanel:(show:boolean) => void;
}

export const ChatPanel: React.FC<IProps> = ({ activeNavTab, document, onCloseChatPanel }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isLoading, isError, data, error } = useDocumentComments(document.key);
  const comments: CommentDocument[] | undefined = data?.docs.map(c => c.data()) as any;
  const mutation = usePostDocumentComment();
  const postComment = useCallback((comment: string) => mutation.mutate({ document, comment }), [document, mutation]);
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
