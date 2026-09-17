import { makeAutoObservable, runInAction } from "mobx";
import { nanoid } from "nanoid";
import { CommentDocument } from "../../lib/firestore-schema";
import { WithId } from "../../hooks/firestore-hooks";
import { IClientCommentParams, IDocumentMetadata, IUserContext, kAnalyzerUserParams } from "../../../shared/shared";
import { IDEAS_EMPTY_MESSAGE, IDEAS_REQUEST_FAILED_MESSAGE } from "./ai-evaluation-messages";

// How long an Ideas click waits for its own Firebase writes/reads (recording the last-edited
// time, then reading it back) before giving up on this attempt. Short: this is a couple of small
// foreground calls, not the AI evaluation itself, which has its own much longer budget below.
export const kIdeasRequestDeadlineMs = 15_000;

export const REMOTE_COMMENT = "remote";
export const LOCAL_COMMENT = "local";

// How long a remote (e.g. AI) pending comment waits for a resolving signal — a comment, a
// completion status, or this expiry — before it gives up on its own. Comfortably above
// Shutterbug's ~45s budget plus the model call.
const kRemoteCommentExpiryMs = 120_000;

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
  /** The Ideas click's request id, when this entry was queued for one. Used to correlate a
   * server-written completion status back to the request that caused it. */
  requestId?: string;
  expiresAt: number;
  /** Called whenever this entry is removed from the queue, for any reason (a comment arrived, a
   * status resolved it, or it expired) — the caller's chance to detach anything set up for it,
   * such as a Realtime Database listener. */
  dispose?: () => void;
}

interface IQueueRemoteCommentParams {
  triggeredAt: number;
  source: string;
  checkCompleted: (comments: CommentWithId[]) => boolean;
  requestId?: string;
  dispose?: () => void;
}

export type EvaluationOutcome = "skipped-empty" | "commented" | "failed";

/** The completion status the analysis pipeline writes when it finishes handling an evaluation
 * request — see docs/firebase-schema.md's evaluationStatus node. */
export interface IEvaluationStatus {
  outcome: EvaluationOutcome;
  requestId?: string;
  docUpdated: number | string;
  completedAt: number;
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

  /** An inline status line shown in place of (or ahead of) a real AI comment: either the
   * "add some work" nudge for an empty document, or a "something went wrong" message when an
   * Ideas request could not be completed. Client-only: never written to Firestore, and
   * deliberately not a `pendingComments` entry (a message waiting for an AI comment would block an
   * exemplar comment queued behind it). */
  statusMessage: { message: string; shownAt: number } | null = null;

  /** The request id of the most recent Ideas click that made a request, or `null` if the most
   * recent click made none (an empty-document click). Records which click is latest, not which
   * request is still pending — it is not cleared when a request resolves. */
  latestIdeasRequestId: string | null = null;

  /** True from the moment an Ideas click starts until its pending entry is queued (or, for an
   * empty-document click, until the handler returns). Covers the window the handler itself
   * `await`s through, before a pending entry exists to gate on. */
  ideasClickInProgress = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Whether a new Ideas click may make a request right now: false while a click is already in
   * progress, or while an AI evaluation is still pending. The nudge does not factor in — an
   * empty-document click makes no request, so the button stays enabled while it shows. */
  get canRequestIdeas() {
    return !this.ideasClickInProgress &&
      !this.pendingComments.some(p => p.postingType === REMOTE_COMMENT && p.source === "ai");
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
      this.removePendingComments(new Set(toRemove));

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

    if (this.statusMessage) {
      const shownAt = this.statusMessage.shownAt;
      const hasNewerAnalyzerComment = comments.some(c =>
        c.uid === kAnalyzerUserParams.id && c.createdAt.getTime() > shownAt);
      if (hasNewerAnalyzerComment) this.clearStatusMessage();
    }

    this.checkPendingComments();
  }

  /** Removes the given pending entries and, for any that are remote comments, calls their
   * `dispose`. The single place entries leave `pendingComments`, so a listener set up for one is
   * never left dangling. */
  private removePendingComments(ids: Set<string>) {
    if (ids.size === 0) return;
    const removed = this.pendingComments.filter(p => ids.has(p.id));
    if (removed.length === 0) return;

    runInAction(() => {
      this.pendingComments = this.pendingComments.filter(p => !ids.has(p.id));
    });

    removed.forEach(p => {
      if (p.postingType === REMOTE_COMMENT) p.dispose?.();
    });
  }

  queueRemoteComment({ triggeredAt, source, checkCompleted, requestId, dispose }: IQueueRemoteCommentParams) {
    const id = `${source}-comment-${nanoid()}`;

    const timer = setTimeout(() => {
      this.removePendingComments(new Set([id]));
      this.checkPendingComments();
    }, kRemoteCommentExpiryMs);

    const wrappedDispose = () => {
      clearTimeout(timer);
      dispose?.();
    };

    const pending: IPendingRemoteComment = {
      id,
      triggeredAt,
      postingType: REMOTE_COMMENT,
      source,
      checkCompleted,
      requestId,
      expiresAt: Date.now() + kRemoteCommentExpiryMs,
      dispose: wrappedDispose
    };

    this.pendingComments.push(pending);
  }

  setLatestIdeasRequestId(id: string | null) {
    this.latestIdeasRequestId = id;
  }

  setIdeasClickInProgress(inProgress: boolean) {
    this.ideasClickInProgress = inProgress;
  }

  showStatusMessage(message: string) {
    this.statusMessage = { message, shownAt: Date.now() };
  }

  clearStatusMessage() {
    this.statusMessage = null;
  }

  /**
   * Applies a completion status the analysis pipeline wrote for an evaluation request. A status
   * with no `requestId` matches nothing (the automatic routes write none, so there is never an
   * entry waiting on them). Matching is always by `requestId`, never by `completedAt` — an older
   * request finishing late must resolve its own entry and nothing more.
   */
  applyEvaluationStatus(status: IEvaluationStatus | null | undefined) {
    if (!status?.requestId) return;

    const matchingIds = new Set(
      this.pendingComments
        .filter((p): p is IPendingRemoteComment =>
          p.postingType === REMOTE_COMMENT && p.requestId === status.requestId)
        .map(p => p.id)
    );
    this.removePendingComments(matchingIds);

    // Only the latest click's status may change what the student sees — an older request
    // resolving late must not show a message over a click the student already made.
    if (status.requestId === this.latestIdeasRequestId) {
      if (status.outcome === "skipped-empty") {
        this.showStatusMessage(IDEAS_EMPTY_MESSAGE);
      } else if (status.outcome === "failed") {
        // Otherwise the pending entry's removal above silently drops the waiting bubble, with
        // nothing telling the student the pipeline actually failed server-side.
        this.showStatusMessage(IDEAS_REQUEST_FAILED_MESSAGE);
      }
    }

    this.checkPendingComments();
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
    // A pending remote comment's dispose clears its expiry timer and detaches whatever the caller
    // set up for it (e.g. a Realtime Database listener) — tearing down the manager counts as the
    // entry being removed, same as a comment, a status, or expiry resolving it.
    this.pendingComments.forEach(p => {
      if (p.postingType === REMOTE_COMMENT) p.dispose?.();
    });
    this.comments = [];
    this.pendingComments = [];
  }
}
