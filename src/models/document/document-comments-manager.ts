import { makeAutoObservable, runInAction } from "mobx";
import { nanoid } from "nanoid";
import { CommentDocument } from "../../lib/firestore-schema";
import { WithId } from "../../hooks/firestore-hooks";
import { IClientCommentParams, IDocumentMetadata, IUserContext } from "../../../shared/shared";

export const REMOTE_COMMENT = "remote";
export const LOCAL_COMMENT = "local";

export type CommentWithId = WithId<CommentDocument>;
export type PendingCommentType = typeof REMOTE_COMMENT | typeof LOCAL_COMMENT;

export interface IPendingComment {
  id: string;
  postingType: PendingCommentType;
  source: string;
}

export interface IPendingRemoteComment extends IPendingComment {
  triggeredAt: number;
  postingType: typeof REMOTE_COMMENT;
  checkCompleted: (comments: CommentWithId[]) => boolean;
}

interface IQueueRemoteCommentParams {
  triggeredAt: number;
  source: string;
  checkCompleted: (comments: CommentWithId[]) => boolean;
}

export interface IPendingLocalComment extends IPendingComment {
  comment: IClientCommentParams;
  context: IUserContext;
  document: IDocumentMetadata;
  postingType: typeof LOCAL_COMMENT;
  postFunction: (params: object) => Promise<any>;
}

export interface IQueueLocalCommentParams {
  comment: IClientCommentParams;
  context: IUserContext;
  document: IDocumentMetadata;
  source: string;
  postFunction: (params: object) => Promise<any>;
}

export type PendingComment = IPendingRemoteComment | IPendingLocalComment;

/**
 * DocumentCommentsManager
 *
 * Manages comments for a document including:
 * - Fetching and monitoring comments from Firestore
 * - Managing a queue of pending comments
 * - Coordinating the order in which comments appear
 *
 */
export class DocumentCommentsManager {
  comments: CommentWithId[] = [];
  pendingComments: PendingComment[] = [];
  private isCheckingPending = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Check pending comments to see if any can be resolved or posted.
   * This is called automatically when comments are updated via Firestore, but can also be called manually.
   */
  async checkPendingComments() {
    if (this.isCheckingPending) return;
    this.isCheckingPending = true;

    try {
      const toRemove: string[] = [];
      const toPost: IPendingLocalComment[] = [];

      for (const pending of this.pendingComments) {
        if (pending.postingType === REMOTE_COMMENT) {
          if (pending.checkCompleted(this.comments)) {
            toRemove.push(pending.id);
          }
        } else {
          // Other comments should be posted after all preceding pending items are resolved.
          const indexOfThis = this.pendingComments.indexOf(pending);
          const allBeforeAreResolved = this.pendingComments
            .slice(0, indexOfThis)
            .every(p => toRemove.includes(p.id));

          if (allBeforeAreResolved) {
            toPost.push(pending);
            toRemove.push(pending.id);
          }
        }
      }

      // Remove resolved items immediately.
      if (toRemove.length > 0) {
        runInAction(() => {
          this.pendingComments = this.pendingComments.filter(p => !toRemove.includes(p.id));
        });
      }

      // Post local comments.
      for (const commentToPost of toPost) {
        try {
          await commentToPost.postFunction({
            comment: commentToPost.comment,
            context: commentToPost.context,
            document: commentToPost.document
          });
        } catch (error) {
          console.error("Failed to post pending local comment:", error);
        }
      }
    } finally {
      this.isCheckingPending = false;
    }
  }

  setComments(comments: CommentWithId[]) {
    this.comments = comments;
    this.checkPendingComments();
  }

  queueRemoteComment({ triggeredAt, source, checkCompleted }: IQueueRemoteCommentParams) {
    const pending: IPendingRemoteComment = {
      id: `${source}-comment-${nanoid()}`,
      triggeredAt,
      postingType: REMOTE_COMMENT,
      source,
      checkCompleted
    };

    this.pendingComments.push(pending);
  }

  queueComment({ comment, context, document, source, postFunction }: IQueueLocalCommentParams) {
    const pending: IPendingLocalComment = {
      id: `local-comment-${nanoid()}`,
      comment,
      context,
      document,
      postingType: LOCAL_COMMENT,
      source,
      postFunction
    };

    this.pendingComments.push(pending);
    this.checkPendingComments();
  }

  dispose() {
    this.comments = [];
    this.pendingComments = [];
  }
}
