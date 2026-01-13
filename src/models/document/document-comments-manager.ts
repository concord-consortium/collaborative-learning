import { makeAutoObservable, runInAction } from "mobx";
import { v4 as uuid } from "uuid";
import { CommentDocument } from "../../lib/firestore-schema";
import { WithId } from "../../hooks/firestore-hooks";
import { IClientCommentParams, IDocumentMetadata, IUserContext } from "../../../shared/shared";

export type CommentWithId = WithId<CommentDocument>;
export type PendingCommentType = "ai-analysis" | "exemplar";

export interface IPendingComment {
  id: string;
  type: PendingCommentType;
}

export interface IPendingAIComment extends IPendingComment {
  triggeredAt: number;
  type: "ai-analysis";
  checkCompleted: (comments: CommentWithId[]) => boolean;
}

export interface IPendingExemplarComment extends IPendingComment {
  comment: IClientCommentParams;
  context: IUserContext;
  document: IDocumentMetadata;
  type: "exemplar";
  postFunction: (params: object) => Promise<any>;
}

export type PendingComment = IPendingAIComment | IPendingExemplarComment;

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

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Check pending comments to see if any can be resolved or posted.
   * This is called automatically when comments are updated via Firestore, but can also be called manually.
   */
  async checkPendingComments() {
    const toRemove: string[] = [];
    const toPost: IPendingExemplarComment[] = [];

    for (const pending of this.pendingComments) {
      if (pending.type === "ai-analysis") {
        if (pending.checkCompleted(this.comments)) {
          toRemove.push(pending.id);
        }
      } else if (pending.type === "exemplar") {
        // Exemplar comments should be posted after all preceding pending items are resolved.
        const indexOfThis = this.pendingComments.indexOf(pending);
        const allBeforeAreResolvedOrExemplars = this.pendingComments
          .slice(0, indexOfThis)
          .every(p => p.type === "exemplar" || toRemove.includes(p.id));

        if (allBeforeAreResolvedOrExemplars) {
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

    // Post exemplar comments.
    for (const exemplar of toPost) {
      try {
        await exemplar.postFunction({
          comment: exemplar.comment,
          context: exemplar.context,
          document: exemplar.document
        });
      } catch (error) {
        console.error("Failed to post pending exemplar comment:", error);
      }
    }
  }

  queuePendingAIComment(triggeredAt: number, checkCompleted: (comments: CommentWithId[]) => boolean) {
    const pending: IPendingAIComment = {
      id: `ai-${uuid()}`,
      triggeredAt,
      type: "ai-analysis",
      checkCompleted
    };

    this.pendingComments.push(pending);
  }

  queuePendingExemplarComment(
    comment: IClientCommentParams,
    context: IUserContext,
    document: IDocumentMetadata,
    postFunction: (params: object) => Promise<any>
  ) {
    const pending: IPendingExemplarComment = {
      comment,
      context,
      document,
      id: `exemplar-${uuid()}`,
      type: "exemplar",
      postFunction
    };

    this.pendingComments.push(pending);
  }

  get isAwaitingAIAnalysis(): boolean {
    return this.pendingComments.some(p => p.type === "ai-analysis");
  }

  dispose() {
    this.comments = [];
    this.pendingComments = [];
  }
}
