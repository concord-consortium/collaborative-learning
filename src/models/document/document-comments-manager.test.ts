import { isObservable, runInAction } from "mobx";
import { kAnalyzerUserParams } from "../../../shared/shared";
import { DocumentModel, DocumentModelType } from "./document";
import { CommentWithId, DocumentCommentsManager } from "./document-comments-manager";
import { ProblemDocument } from "./document-types";

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

  describe("queueRemoteComment", () => {
    it("should add remote comment to pending queue", () => {
      const checkCompleted = jest.fn(() => false);
      const triggeredAt = Date.now();

      manager.queueRemoteComment({ triggeredAt, source: "ai", checkCompleted });

      expect(manager.pendingComments).toHaveLength(1);
      expect(manager.pendingComments[0].postingType).toBe("remote");
    });

    it("should generate unique IDs for pending remote comments", () => {
      const checkCompleted = jest.fn(() => false);

      manager.queueRemoteComment({ triggeredAt: Date.now(), source: "ai", checkCompleted });
      manager.queueRemoteComment({ triggeredAt: Date.now(), source: "ai", checkCompleted });
      const ids = manager.pendingComments.map(p => p.id);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe("queueComment", () => {
    it("should add comment to pending queue and process immediately", async () => {
      const postFunction = jest.fn().mockResolvedValue({ id: "comment1" });

      manager.queueComment({
        comment: {
          content: "See if this example gives you any new ideas:",
          linkedDocumentKey: "exemplar-doc-123"
        },
        context: { classHash: "class1", appMode: "test" },
        document: { uid: "user1", type: "problem", key: "doc1" },
        source: "exemplar",
        postFunction
      });


      await new Promise(resolve => setTimeout(resolve, 0));

      expect(postFunction).toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(0);
    });

    it("should store all comment data and pass to postFunction", async () => {
      const comment = {
        content: "Test comment",
        linkedDocumentKey: "doc123"
      };
      const context = { classHash: "class1", appMode: "test" };
      const document = { uid: "user1", type: "problem", key: "doc1" };
      const postFunction = jest.fn().mockResolvedValue({ id: "comment1" });

      manager.queueComment({
        comment,
        context,
        document,
        source: "exemplar",
        postFunction
      });


      await new Promise(resolve => setTimeout(resolve, 0));

      expect(postFunction).toHaveBeenCalledWith({
        comment,
        context,
        document
      });
      expect(manager.pendingComments).toHaveLength(0);
    });

    it("should generate unique IDs for pending local comments", () => {
      const postFunction = jest.fn().mockResolvedValue({ id: "comment1" });
      const comment = {
        content: "Test comment",
        linkedDocumentKey: "doc123"
      };
      const context = { classHash: "class1", appMode: "test" };
      const document = { uid: "user1", type: "problem", key: "doc1" };

      manager.queueComment({
        comment,
        context,
        document,
        source: "exemplar",
        postFunction
      });
      manager.queueComment({
        comment,
        context,
        document,
        source: "exemplar",
        postFunction: jest.fn().mockResolvedValue({ id: "comment2" })
      });
      const ids = manager.pendingComments.map(p => p.id);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe("comment coordination", () => {
    it("should automatically check and resolve remote comments when comments arrive", () => {
      const triggeredAt = Date.now() - 1000;
      const checkCompleted = jest.fn((comments) => {
        return comments.some((c: CommentWithId) =>
          c.uid === kAnalyzerUserParams.id &&
          c.createdAt.getTime() > triggeredAt
        );
      });

      manager.queueRemoteComment({ triggeredAt, source: "ai", checkCompleted });

      // Simulate new remote comment arriving
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

    it("should handle errors in comment posting gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const postExemplar = jest.fn().mockRejectedValue(new Error("Post failed"));

      manager.queueComment({
        comment: { content: "Test", linkedDocumentKey: "ex1" },
        context: { classHash: "class1", appMode: "test" },
        document: { uid: "u1", type: "problem", key: "d1" },
        source: "exemplar",
        postFunction: postExemplar
      });

      await manager.checkPendingComments();

      expect(postExemplar).toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it("should allow multiple comments to be queued and posted in order", async () => {
      const postEx1 = jest.fn().mockResolvedValue({ id: "ex1" });
      const postEx2 = jest.fn().mockResolvedValue({ id: "ex2" });

      manager.queueComment({
        comment: { content: "Exemplar 1", linkedDocumentKey: "ex1" },
        context: { classHash: "class1", appMode: "test" },
        document: { uid: "u1", type: "problem", key: "d1" },
        source: "exemplar",
        postFunction: postEx1
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      manager.queueComment({
        comment: { content: "Exemplar 2", linkedDocumentKey: "ex2" },
        context: { classHash: "class1", appMode: "test" },
        document: { uid: "u1", type: "problem", key: "d1" },
        source: "exemplar",
        postFunction: postEx2
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify both functions were called and in the correct order
      expect(postEx1).toHaveBeenCalled();
      expect(postEx2).toHaveBeenCalled();
      expect(postEx1.mock.invocationCallOrder[0]).toBeLessThan(postEx2.mock.invocationCallOrder[0]);
      expect(manager.pendingComments).toHaveLength(0);
    });
  });

  describe("dispose", () => {
    it("should clean up all state", () => {
      manager.queueRemoteComment({
        triggeredAt: Date.now(), source: "ai", checkCompleted: () => false
      });
      manager.queueComment({
        comment: { content: "Test" },
        context: { classHash: "test", appMode: "test" },
        document: { uid: "u1", type: "problem", key: "d1" },
        source: "exemplar",
        postFunction: jest.fn()
      });

      manager.dispose();

      expect(manager.comments).toEqual([]);
      expect(manager.pendingComments).toEqual([]);
    });
  });

  describe("Remote and local comments coordination", () => {
    it("should handle Ideas button click > AI analysis > exemplar reveal flow", async () => {
      // Simulate user clicks Ideas button, triggering AI analysis.
      const docLastEditedTime = Date.now();
      const checkRemoteComplete = jest.fn((comments) => {
        const lastRemoteComment = [...comments]
          .reverse()
          .find(c => c.uid === kAnalyzerUserParams.id);
        return !!(lastRemoteComment && lastRemoteComment.createdAt.getTime() > docLastEditedTime);
      });

      manager.queueRemoteComment({
        triggeredAt: docLastEditedTime, source: "ai", checkCompleted: checkRemoteComplete
      });

      const postLocalComment = jest.fn().mockResolvedValue({ id: "ex1" });
      manager.queueComment({
        comment: { content: "See if this example gives you any new ideas:", linkedDocumentKey: "ex1" },
        context: { classHash: "class1", appMode: "test" },
        document: { uid: "user1", type: "problem", key: "doc1" },
        source: "exemplar",
        postFunction: postLocalComment
      });

      expect(postLocalComment).not.toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(2);

      // Simulate remote comment arriving
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

      expect(checkRemoteComplete).toHaveBeenCalled();
      expect(postLocalComment).toHaveBeenCalled();
      expect(manager.pendingComments).toHaveLength(0);

    });

    it("should handle comment when remote is not pending", async () => {
      const postLocalComment = jest.fn().mockResolvedValue({ id: "ex1" });

      manager.queueComment({
        comment: { content: "See if this example gives you any new ideas:", linkedDocumentKey: "ex1" },
        context: { classHash: "class1", appMode: "test" },
        document: { uid: "user1", type: "problem", key: "doc1" },
        source: "exemplar",
        postFunction: postLocalComment
      });

      await manager.checkPendingComments();

      expect(postLocalComment).toHaveBeenCalled();
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
