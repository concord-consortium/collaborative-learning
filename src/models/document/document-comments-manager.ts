import { makeAutoObservable, runInAction } from "mobx";
import { nanoid } from "nanoid";
import { CommentDocument } from "../../lib/firestore-schema";
import { WithId } from "../../hooks/firestore-hooks";
import { IClientCommentParams, IDocumentMetadata, IUserContext, kAnalyzerUserParams } from "../../../shared/shared";
import { IDEAS_EMPTY_MESSAGE, IDEAS_REQUEST_FAILED_MESSAGE } from "./ai-evaluation-messages";

// How long an Ideas click's own Firebase writes/reads may take before giving up on this attempt.
// Short — these are small foreground calls, not the evaluation itself (see below).
export const kIdeasRequestDeadlineMs = 15_000;

export const REMOTE_COMMENT = "remote";
export const LOCAL_COMMENT = "local";

// How long a pending remote comment waits for a comment, a status, or this expiry before giving
// up. Comfortably above Shutterbug's ~45s budget plus the model call.
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
  /** The Ideas click's request id, used to correlate a completion status back to it. */
  requestId?: string;
  expiresAt: number;
  /** Called when this entry leaves the queue, so the caller can detach anything it set up (e.g. a
   * Realtime Database listener). */
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

/** The completion status the analysis pipeline writes for an evaluation request — see
 * docs/firebase-schema.md's evaluationStatus node. */
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

  /** An inline status line shown in place of a real AI comment: the "add some work" nudge, or a
   * failure message. Client-only, and deliberately not a `pendingComments` entry — it would
   * otherwise block an exemplar comment queued behind it. `priorAnalyzerCommentIds` is the set of
   * analyzer comment ids that already existed when the message was shown, so a newer one can be
   * detected by id rather than by comparing this client's clock against Firestore's server clock. */
  statusMessage: { message: string; priorAnalyzerCommentIds: Set<string> } | null = null;

  /** The request id of the most recent Ideas click, or `null` if it made none (an empty-document
   * click). Not cleared when a request resolves — it tracks the latest click, not what's pending. */
  latestIdeasRequestId: string | null = null;

  /** True from the start of an Ideas click until its pending entry is queued (or, for an
   * empty-document click, until the handler returns). */
  ideasClickInProgress = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Whether a new Ideas click may make a request: false while one is in progress or an AI
   * evaluation is pending. The nudge doesn't factor in — an empty click makes no request. */
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
      const { priorAnalyzerCommentIds } = this.statusMessage;
      const hasNewAnalyzerComment = comments.some(c =>
        c.uid === kAnalyzerUserParams.id && !priorAnalyzerCommentIds.has(c.id));
      if (hasNewAnalyzerComment) this.clearStatusMessage();
    }

    this.checkPendingComments();
  }

  /** Removes the given pending entries, calling `dispose` on any remote ones. The single place
   * entries leave `pendingComments`, so a listener set up for one is never left dangling. */
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
      // Nothing else resolved this entry (no comment, no status) within the expiry window. Say so
      // rather than letting the bubble vanish unexplained.
      if (requestId && requestId === this.latestIdeasRequestId) {
        this.showStatusMessage(IDEAS_REQUEST_FAILED_MESSAGE);
      }
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
    const priorAnalyzerCommentIds = new Set(
      this.comments.filter(c => c.uid === kAnalyzerUserParams.id).map(c => c.id)
    );
    this.statusMessage = { message, priorAnalyzerCommentIds };
  }

  clearStatusMessage() {
    this.statusMessage = null;
  }

  /**
   * Applies a completion status the analysis pipeline wrote for an evaluation request. Matches by
   * `requestId` only, never `completedAt` — an older request finishing late must resolve only its
   * own entry.
   *
   * A `"commented"` status does nothing: it arrives over the Realtime Database while the comment
   * itself arrives over Firestore, with no ordering between the two, so resolving on the status
   * could let a queued exemplar comment post before Ada's own comment lands. Only the comment
   * (via `checkCompleted`) or the 120s expiry resolves a commented request.
   */
  applyEvaluationStatus(status: IEvaluationStatus | null | undefined) {
    if (!status?.requestId) return;
    if (status.outcome === "commented") return;

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
    this.pendingComments.forEach(p => {
      if (p.postingType === REMOTE_COMMENT) p.dispose?.();
    });
    this.comments = [];
    this.pendingComments = [];
  }
}
