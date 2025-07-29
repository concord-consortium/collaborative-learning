import { WithId } from "src/hooks/firestore-hooks";
import { CommentDocument } from "src/lib/firestore-schema";
import { DocumentContentModelType } from "src/models/document/document-content";

export interface ChatCommentThread {
  title: string | null | undefined;
  tileId: string | null;
  tileType: string | null;
  comments: WithId<CommentDocument>[];
}

// Expects a list of comments in Document order with document level comments (with no (null) tileId) first.
export function makeChatThreads (
    commentsInDocumentOrder: WithId<CommentDocument>[] | undefined,
    content: DocumentContentModelType | undefined,
    docTitle?: string) : ChatCommentThread[] {
  const chatThreads: ChatCommentThread[] = [];
  // Since the comments are sorted by tile id already, each time we encounter a new tile id, we make a new thread.
  commentsInDocumentOrder?.forEach((comment, idx)=> {
    // If the comment's tile id is the same as the most recent one, add it there
    const tileId = comment.tileId === undefined ? null : comment.tileId;
    if (chatThreads.length > 0 && tileId === chatThreads[chatThreads.length - 1].tileId) {
      chatThreads[chatThreads.length - 1].comments.push(comment);
    } else {
      // Start a new thread.
      let isTileComment = false;
      let tile;
      if (comment.tileId != null) {
        isTileComment = true;
        tile = content?.getTile(comment.tileId);
      }
      chatThreads.push({
        title: isTileComment ? (tile ? tile.computedTitle: null) : docTitle || null,
        tileType: isTileComment && tile ? tile.content?.type : null,
        tileId: isTileComment ? tileId : null,
        comments: [comment]
      });
    }
  });
  return chatThreads;
}
