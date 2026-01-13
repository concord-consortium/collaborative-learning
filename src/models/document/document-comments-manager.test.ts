import { isObservable, runInAction } from "mobx";
import { CommentWithId, DocumentCommentsManager, IPendingExemplarComment } from "./document-comments-manager";
import { DocumentModel, DocumentModelType } from "./document";
import { ProblemDocument } from "./document-types";
import { kAnalyzerUserParams } from "../../../shared/shared";

jest.mock("firebase/app", () => ({
  __esModule: true,
  default: {
    functions: () => ({
      httpsCallable: (name: string) => jest.fn().mockResolvedValue({ data: { id: "comment1" } })
    })
  },
  firestore: {
    Timestamp: {
      fromDate: (date: Date) => ({ toDate: () => date })
    }
  }
}));

describe("DocumentCommentsManager", () => {
  let manager: DocumentCommentsManager;

  beforeEach(() => {
    manager = new DocumentCommentsManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe("initialization", () => {
    it("should start with empty comments and comments queue arrays", () => {
      expect(manager.comments).toEqual([]);
      expect(manager.pendingComments).toEqual([]);
    });

    it("should initialize as MobX observable", () => {
      expect(isObservable(manager)).toBe(true);
    });
  });

  describe("queuePendingAIComment", () => {
    it("should add AI comment to pending queue", () => {
      const checkCompleted = jest.fn(() => false);
      const triggeredAt = Date.now();

      manager.queuePendingAIComment(triggeredAt, checkCompleted);

      expect(manager.pendingComments).toHaveLength(1);
      expect(manager.pendingComments[0].type).toBe("ai-analysis");
      expect(manager.isAwaitingAIAnalysis).toBe(true);
    });

    it("should generate unique IDs for pending AI comments", () => {
      const checkCompleted = jest.fn(() => false);

      manager.queuePendingAIComment(Date.now(), checkCompleted);
      manager.queuePendingAIComment(Date.now(), checkCompleted);

      const ids = manager.pendingComments.map(p => p.id);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe("queuePendingExemplarComment", () => {
    it("should add exemplar comment to pending queue", () => {
      const postFunction = jest.fn().mockResolvedValue({ id: "comment1" });
      const comment = {
        content: "See if this example gives you any new ideas:",
        linkedDocumentKey: "exemplar-doc-123"
      };
      const context = { classHash: "class1", appMode: "test" };
      const document = { uid: "user1", type: "problem", key: "doc1" };

      manager.queuePendingExemplarComment(comment, context, document, postFunction);

      expect(manager.pendingComments).toHaveLength(1);
      expect(manager.pendingComments[0].type).toBe("exemplar");
    });

    it("should store all exemplar comment data", () => {
      const postFunction = jest.fn().mockResolvedValue({ id: "comment1" });
      const comment = {
        content: "Test comment",
        linkedDocumentKey: "doc123"
      };
      const context = { classHash: "class1", appMode: "test" };
      const document = { uid: "user1", type: "problem", key: "doc1" };

      manager.queuePendingExemplarComment(comment, context, document, postFunction);

      const pending = manager.pendingComments[0] as IPendingExemplarComment;
      expect(pending.comment).toEqual(comment);
      expect(pending.context).toEqual(context);
      expect(pending.document).toEqual(document);
      expect(pending.postFunction).toBeDefined();
      expect(typeof pending.postFunction).toBe("function");
    });

    it("should generate unique IDs for pending exemplar comments", () => {
      const postFunction = jest.fn().mockResolvedValue({ id: "comment1" });
      const comment = {
        content: "Test comment",
        linkedDocumentKey: "doc123"
      };
      const context = { classHash: "class1", appMode: "test" };
      const document = { uid: "user1", type: "problem", key: "doc1" };

      manager.queuePendingExemplarComment(comment, context, document, postFunction);
      manager.queuePendingExemplarComment(comment, context, document, postFunction);
      const ids = manager.pendingComments.map(p => p.id);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe("comment coordination", () => {
    it("should automatically check and resolve AI comments when comments arrive", () => {
      const triggeredAt = Date.now() - 1000;
      const checkCompleted = jest.fn((comments) => {
        return comments.some((c: CommentWithId) =>
          c.uid === kAnalyzerUserParams.id &&
          c.createdAt.getTime() > triggeredAt
        );
      });

      manager.queuePendingAIComment(triggeredAt, checkCompleted);
      expect(manager.isAwaitingAIAnalysis).toBe(true);

      // Simulate new AI comment arriving
      runInAction(() => {
        manager.comments = [{
          content: "AI analysis result",
          createdAt: new Date(Date.now()),
          id: "ai-comment-1",
          name: "Ada Insight",
          network: "test",
          uid: kAnalyzerUserParams.id
        }];
      });

      manager.checkPendingComments();

      expect(checkCompleted).toHaveBeenCalled();
    });

    it("should handle errors in exemplar posting gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const postExemplar = jest.fn().mockRejectedValue(new Error("Post failed"));

      manager.queuePendingExemplarComment(
        { content: "Test", linkedDocumentKey: "ex1" },
        { classHash: "class1", appMode: "test" },
        { uid: "u1", type: "problem", key: "d1" },
        postExemplar
      );

      await manager.checkPendingComments();

      expect(postExemplar).toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it("should allow multiple exemplars to be queued and posted in order", async () => {
      const postEx1 = jest.fn().mockResolvedValue({ id: "ex1" });
      const postEx2 = jest.fn().mockResolvedValue({ id: "ex2" });

      manager.queuePendingExemplarComment(
        { content: "Exemplar 1", linkedDocumentKey: "ex1" },
        { classHash: "class1", appMode: "test" },
        { uid: "u1", type: "problem", key: "d1" },
        postEx1
      );

      manager.queuePendingExemplarComment(
        { content: "Exemplar 2", linkedDocumentKey: "ex2" },
        { classHash: "class1", appMode: "test" },
        { uid: "u1", type: "problem", key: "d1" },
        postEx2
      );

      await manager.checkPendingComments();

      expect(postEx1).toHaveBeenCalled();
      expect(postEx2).toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(0);
    });
  });

  describe("computed properties", () => {
    it("isAwaitingAIAnalysis should reflect pending AI comments", () => {
      expect(manager.isAwaitingAIAnalysis).toBe(false);

      manager.queuePendingAIComment(Date.now(), () => false);
      expect(manager.isAwaitingAIAnalysis).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should clean up all state", () => {
      manager.queuePendingAIComment(Date.now(), () => false);
      manager.queuePendingExemplarComment(
        { content: "Test" },
        { classHash: "test", appMode: "test" },
        { uid: "u1", type: "problem", key: "d1" },
        jest.fn()
      );

      manager.dispose();

      expect(manager.comments).toEqual([]);
      expect(manager.pendingComments).toEqual([]);
    });
  });

  describe("AI and exemplar coordination", () => {
    it("should handle Ideas button click > AI analysis > exemplar reveal flow", async () => {
      // Simulate user clicks Ideas button, triggering AI analysis.
      const docLastEditedTime = Date.now();
      const checkAIComplete = jest.fn((comments) => {
        const lastAIComment = [...comments]
          .reverse()
          .find(c => c.uid === kAnalyzerUserParams.id);
        return !!(lastAIComment && lastAIComment.createdAt.getTime() > docLastEditedTime);
      });

      manager.queuePendingAIComment(docLastEditedTime, checkAIComplete);
      expect(manager.isAwaitingAIAnalysis).toBe(true);

      const postExemplar = jest.fn().mockResolvedValue({ id: "ex1" });
      manager.queuePendingExemplarComment(
        { content: "See if this example gives you any new ideas:", linkedDocumentKey: "ex1" },
        { classHash: "class1", appMode: "test" },
        { uid: "user1", type: "problem", key: "doc1" },
        postExemplar
      );

      expect(postExemplar).not.toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(2);

      // Simulate AI comment arriving
      runInAction(() => {
        manager.comments = [{
          id: "ai-1",
          uid: kAnalyzerUserParams.id,
          name: "Ada Insight",
          content: "Your solution shows good understanding of...",
          createdAt: new Date(docLastEditedTime + 5000),
          network: "test"
        }];
      });

      await manager.checkPendingComments();

      expect(checkAIComplete).toHaveBeenCalled();
      expect(manager.isAwaitingAIAnalysis).toBe(false);
      expect(postExemplar).toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(0);

    });

    it("should handle exemplar triggered when AI is not pending", async () => {
      const postExemplar = jest.fn().mockResolvedValue({ id: "ex1" });

      expect(manager.isAwaitingAIAnalysis).toBe(false);

      manager.queuePendingExemplarComment(
        { content: "See if this example gives you any new ideas:", linkedDocumentKey: "ex1" },
        { classHash: "class1", appMode: "test" },
        { uid: "user1", type: "problem", key: "doc1" },
        postExemplar
      );

      await manager.checkPendingComments();

      expect(postExemplar).toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(0);
    });
  });

  describe("DocumentModel integration", () => {
    let document: DocumentModelType;

    beforeEach(() => {
      document = DocumentModel.create({
        key: "doc1",
        title: "Test Document",
        type: ProblemDocument,
        uid: "user1"
      });
    });

    afterEach(() => {
      document.commentsManager?.dispose();
    });

    it("should automatically create commentsManager on document initialization", () => {
      expect(document.commentsManager).toBeDefined();
      expect(document.commentsManager).toBeInstanceOf(DocumentCommentsManager);
    });
  });
});
