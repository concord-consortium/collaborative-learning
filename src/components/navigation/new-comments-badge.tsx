import React from "react";
import { useUnreadDocumentComments } from "../../hooks/document-comment-hooks";

interface IProps {
  documentKey?: string;
}
export const NewCommentsBadge = ({ documentKey }: IProps) => {
  const { data: unreadComments } = useUnreadDocumentComments(documentKey || "");
  const newComments = unreadComments?.length;
  return documentKey && newComments
          ? <div className="new-comment-badge">{newComments}</div>
          : null;
};
