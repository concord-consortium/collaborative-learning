import { makeAutoObservable, runInAction } from "mobx";
import firebase from "firebase/app";
import { v4 as uuid } from "uuid";
import { CommentDocument } from "../../lib/firestore-schema";
import { WithId } from "../../hooks/firestore-hooks";
import { IClientCommentParams, IDocumentMetadata, IUserContext } from "../../../shared/shared";

export type CommentWithId = WithId<CommentDocument>;
export type PendingCommentType = "ai-analysis" | "exemplar" | "custom";

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

export interface IPendingCustomComment extends IPendingComment {
  postParams?: object;
  type: "custom";
  checkCompleted?: (comments: CommentWithId[]) => boolean;
  postFunction?: (params: object) => Promise<any>;
}

export type PendingComment = IPendingAIComment | IPendingExemplarComment | IPendingCustomComment;

const commentConverter = {
  toFirestore: (comment: CommentDocument) => {
    const { createdAt: createdAtDate, ...others } = comment;
    const createdAt = createdAtDate ? firebase.firestore.Timestamp.fromDate(createdAtDate) : undefined;
    return { createdAt, ...others };
  },
  fromFirestore: (doc: firebase.firestore.QueryDocumentSnapshot): CommentDocument => {
    const { createdAt, ...others } = doc.data();
    return { createdAt: createdAt?.toDate(), ...others } as CommentDocument;
  }
};

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
  private firestore: firebase.firestore.Firestore | null = null;
  private unsubscribeLegacy: (() => void) | null = null;
  private unsubscribeSimplified: (() => void) | null = null;
  private firestoreRoot: string = "";

  /** All comments from both paths */
  comments: CommentWithId[] = [];

  /** Comments from the legacy path (with uid prefix) */
  legacyComments: CommentWithId[] = [];

  /** Comments from the simplified path (without uid prefix) */
  simplifiedComments: CommentWithId[] = [];

  /** Queue of pending comments waiting to be posted or resolved */
  pendingComments: PendingComment[] = [];

  /** Whether the manager is actively monitoring Firestore */
  isMonitoring: boolean = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Start monitoring comments for the given document path
   */
  startMonitoring(
    firestore: firebase.firestore.Firestore,
    firestoreRoot: string,
    legacyPath: string,
    simplifiedPath: string
  ) {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }

    this.firestore = firestore;
    this.firestoreRoot = firestoreRoot;
    this.isMonitoring = true;

    // Monitor legacy path (for curriculum and user-posted comments)
    if (legacyPath) {
      const legacyRef = firestore
        .collection(`${firestoreRoot}/${legacyPath}`)
        .withConverter(commentConverter)
        .orderBy("createdAt");

      this.unsubscribeLegacy = legacyRef.onSnapshot(querySnapshot => {
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        runInAction(() => {
          this.legacyComments = docs;
          this.updateComments();
        });
      });
    }

    // Monitor simplified path (for AI and system-posted comments)
    if (simplifiedPath) {
      const simplifiedRef = firestore
        .collection(`${firestoreRoot}/${simplifiedPath}`)
        .withConverter(commentConverter)
        .orderBy("createdAt");

      this.unsubscribeSimplified = simplifiedRef.onSnapshot(querySnapshot => {
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        runInAction(() => {
          this.simplifiedComments = docs;
          this.updateComments();
        });
      });
    }
  }

  /**
   * Stop monitoring comments
   */
  stopMonitoring() {
    this.unsubscribeLegacy?.();
    this.unsubscribeSimplified?.();
    this.unsubscribeLegacy = null;
    this.unsubscribeSimplified = null;
    this.isMonitoring = false;
  }

  /**
   * Update the combined comments list and check pending comments
   */
  private updateComments() {
    this.comments = [...this.legacyComments, ...this.simplifiedComments]
      .sort((a, b) => {
        const ta = a.createdAt?.getTime() ?? 0;
        const tb = b.createdAt?.getTime() ?? 0;
        return ta - tb;
      });

    this.checkPendingComments();
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
      } else if (pending.type === "custom") {
        if (pending.checkCompleted && pending.checkCompleted(this.comments)) {
          if (pending.postFunction && pending.postParams) {
            try {
              await pending.postFunction(pending.postParams);
            } catch (error) {
              console.error("Failed to post custom pending comment:", error);
            }
          }
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

  /**
   * Queue a pending AI analysis comment.
   */
  queuePendingAIComment(triggeredAt: number, checkCompleted: (comments: CommentWithId[]) => boolean) {
    const pending: IPendingAIComment = {
      id: `ai-${uuid()}`,
      triggeredAt,
      type: "ai-analysis",
      checkCompleted
    };

    this.pendingComments.push(pending);
  }

  /**
   * Queue a pending exemplar comment.
   */
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

  /**
   * Queue a custom pending comment.
   */
  queueCustomPendingComment(
    checkCompleted?: (comments: CommentWithId[]) => boolean,
    postFunction?: (params: object) => Promise<any>,
    postParams?: object
  ) {
    const pending: IPendingCustomComment = {
      id: `custom-${uuid()}`,
      type: "custom",
      checkCompleted,
      postFunction,
      postParams
    };

    this.pendingComments.push(pending);
  }

  get isAwaitingAIAnalysis(): boolean {
    return this.pendingComments.some(p => p.type === "ai-analysis");
  }

  get hasPendingExemplars(): boolean {
    return this.pendingComments.some(p => p.type === "exemplar");
  }

  getPendingCount(type: PendingCommentType): number {
    return this.pendingComments.filter(p => p.type === type).length;
  }

  clearPendingComments(type?: PendingCommentType) {
    if (type) {
      this.pendingComments = this.pendingComments.filter(p => p.type !== type);
    } else {
      this.pendingComments = [];
    }
  }

  dispose() {
    this.stopMonitoring();
    this.comments = [];
    this.legacyComments = [];
    this.pendingComments = [];
    this.simplifiedComments = [];
  }
}
