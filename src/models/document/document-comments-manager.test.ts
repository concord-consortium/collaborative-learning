import { isObservable, runInAction } from "mobx";
import { kAnalyzerUserParams } from "../../../shared/shared";
import { DocumentModel, DocumentModelType } from "./document";
import { CommentWithId, DocumentCommentsManager } from "./document-comments-manager";
import { ProblemDocument } from "./document-types";
import { IDEAS_EMPTY_MESSAGE, IDEAS_REQUEST_FAILED_MESSAGE } from "./ai-evaluation-messages";

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

  describe("empty-document nudge", () => {
    it("shows and clears the nudge", () => {
      manager.showStatusMessage("Add some work");
      expect(manager.statusMessage).toMatchObject({ message: "Add some work" });

      manager.clearStatusMessage();
      expect(manager.statusMessage).toBeNull();
    });

    it("clears the nudge when a new AI comment arrives", () => {
      manager.showStatusMessage("Add some work");

      manager.setComments([{
        id: "ai-1",
        uid: kAnalyzerUserParams.id,
        name: "Ada Insight",
        content: "hi",
        createdAt: new Date(),
        network: "test"
      }]);

      expect(manager.statusMessage).toBeNull();
    });

    // A new comment's id is enough on its own; nothing here depends on comparing this client's
    // clock against the server's, so an arbitrarily old server timestamp (as a fast client clock
    // would otherwise appear to be, relative to shownAt) still clears the message.
    it("clears the nudge for a new AI comment even with a server timestamp far in the past", () => {
      manager.showStatusMessage("Add some work");

      manager.setComments([{
        id: "ai-1",
        uid: kAnalyzerUserParams.id,
        name: "Ada Insight",
        content: "hi",
        createdAt: new Date(0),
        network: "test"
      }]);

      expect(manager.statusMessage).toBeNull();
    });

    it("does not clear the nudge for an AI comment that already existed when it was shown", () => {
      // Present before the nudge is shown, so its id is already in priorAnalyzerCommentIds.
      manager.setComments([{
        id: "ai-1",
        uid: kAnalyzerUserParams.id,
        name: "Ada Insight",
        content: "hi",
        createdAt: new Date(),
        network: "test"
      }]);
      manager.showStatusMessage("Add some work");

      // Re-delivering the same comments (e.g. a Firestore snapshot re-firing) must not clear it.
      manager.setComments([{
        id: "ai-1",
        uid: kAnalyzerUserParams.id,
        name: "Ada Insight",
        content: "hi",
        createdAt: new Date(),
        network: "test"
      }]);

      expect(manager.statusMessage).not.toBeNull();
    });

    it("does not block a queued local (exemplar) comment from posting", async () => {
      manager.showStatusMessage("Add some work");
      const postFunction = jest.fn().mockResolvedValue({ id: "ex1" });

      manager.queueComment({
        comment: { content: "See if this gives you ideas", linkedDocumentKey: "ex1" },
        context: { classHash: "class1", appMode: "test" },
        document: { uid: "user1", type: "problem", key: "doc1" },
        source: "exemplar",
        postFunction
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(postFunction).toHaveBeenCalled();
      expect(manager.statusMessage).not.toBeNull();
    });
  });

  describe("canRequestIdeas", () => {
    it("is true when idle", () => {
      expect(manager.canRequestIdeas).toBe(true);
    });

    it("is false while a click is in progress", () => {
      manager.setIdeasClickInProgress(true);
      expect(manager.canRequestIdeas).toBe(false);

      manager.setIdeasClickInProgress(false);
      expect(manager.canRequestIdeas).toBe(true);
    });

    it("is false while an ai remote entry is pending, true once it resolves", () => {
      manager.queueRemoteComment({ triggeredAt: Date.now(), source: "ai", checkCompleted: () => true });
      expect(manager.canRequestIdeas).toBe(false);

      manager.checkPendingComments();
      expect(manager.canRequestIdeas).toBe(true);
    });

    it("goes through the full cycle: idle -> click in progress -> entry queued -> resolved -> idle", () => {
      expect(manager.canRequestIdeas).toBe(true);

      manager.setIdeasClickInProgress(true);
      expect(manager.canRequestIdeas).toBe(false);

      let resolved = false;
      manager.queueRemoteComment({ triggeredAt: Date.now(), source: "ai", checkCompleted: () => resolved });
      manager.setIdeasClickInProgress(false);
      expect(manager.canRequestIdeas).toBe(false); // the pending entry still gates it

      resolved = true;
      manager.checkPendingComments();
      expect(manager.canRequestIdeas).toBe(true);
    });

    it("is unaffected by the nudge or a queued local (exemplar) entry", () => {
      manager.showStatusMessage("Add some work");
      expect(manager.canRequestIdeas).toBe(true);

      manager.queueComment({
        comment: { content: "test" },
        context: { classHash: "c1", appMode: "test" },
        document: { uid: "u1", type: "problem", key: "d1" },
        source: "exemplar",
        postFunction: jest.fn().mockResolvedValue({})
      });
      expect(manager.canRequestIdeas).toBe(true);
    });
  });

  describe("applyEvaluationStatus", () => {
    function queueForRequest(requestId: string, checkCompleted: () => boolean = () => false, dispose = jest.fn()) {
      manager.queueRemoteComment({ triggeredAt: Date.now(), source: "ai", checkCompleted, requestId, dispose });
      return dispose;
    }

    it("ignores a status with no requestId", () => {
      const dispose = queueForRequest("req-a");
      manager.setLatestIdeasRequestId("req-a");

      manager.applyEvaluationStatus({ outcome: "skipped-empty", docUpdated: 1, completedAt: 1 });

      expect(manager.pendingComments).toHaveLength(1);
      expect(dispose).not.toHaveBeenCalled();
      expect(manager.statusMessage).toBeNull();
    });

    it("ignores a null status", () => {
      queueForRequest("req-a");
      manager.setLatestIdeasRequestId("req-a");

      expect(() => manager.applyEvaluationStatus(null)).not.toThrow();
      expect(manager.pendingComments).toHaveLength(1);
    });

    it("resolves the matching entry and shows the nudge for a skipped-empty status on the latest request", () => {
      const dispose = queueForRequest("req-a");
      manager.setLatestIdeasRequestId("req-a");

      manager.applyEvaluationStatus({ outcome: "skipped-empty", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.pendingComments).toHaveLength(0);
      expect(dispose).toHaveBeenCalled();
      expect(manager.statusMessage).toMatchObject({ message: IDEAS_EMPTY_MESSAGE });
    });

    it("resolves the matching entry and shows a failure message for a failed status on the latest request", () => {
      const dispose = queueForRequest("req-a");
      manager.setLatestIdeasRequestId("req-a");

      manager.applyEvaluationStatus({ outcome: "failed", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.pendingComments).toHaveLength(0);
      expect(dispose).toHaveBeenCalled();
      expect(manager.statusMessage).toMatchObject({ message: IDEAS_REQUEST_FAILED_MESSAGE });
    });

    it("a commented status for the latest request leaves the entry pending and shows nothing", () => {
      const dispose = queueForRequest("req-a");
      manager.setLatestIdeasRequestId("req-a");

      manager.applyEvaluationStatus({ outcome: "commented", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.pendingComments).toHaveLength(1);
      expect(dispose).not.toHaveBeenCalled();
      expect(manager.statusMessage).toBeNull();
      expect(manager.canRequestIdeas).toBe(false);
    });

    it("resolves an entry whose request id is not the latest, and shows no failure message", () => {
      const disposeA = queueForRequest("req-a");
      manager.setLatestIdeasRequestId("req-b"); // the student has since clicked again

      manager.applyEvaluationStatus({ outcome: "failed", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.pendingComments).toHaveLength(0);
      expect(disposeA).toHaveBeenCalled();
      expect(manager.statusMessage).toBeNull();
    });

    it("resolves an entry whose request id is not the latest, and shows nothing", () => {
      const disposeA = queueForRequest("req-a");
      manager.setLatestIdeasRequestId("req-b"); // the student has since clicked again

      manager.applyEvaluationStatus({ outcome: "skipped-empty", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.pendingComments).toHaveLength(0);
      expect(disposeA).toHaveBeenCalled();
      expect(manager.statusMessage).toBeNull();
    });

    it("with A then B pending, A's skipped-empty resolves A only and shows no nudge", () => {
      const disposeA = queueForRequest("req-a");
      const disposeB = queueForRequest("req-b");
      manager.setLatestIdeasRequestId("req-b");

      manager.applyEvaluationStatus({ outcome: "skipped-empty", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.pendingComments).toHaveLength(1);
      expect(manager.pendingComments[0]).toMatchObject({ requestId: "req-b" });
      expect(disposeA).toHaveBeenCalled();
      expect(disposeB).not.toHaveBeenCalled();
      expect(manager.statusMessage).toBeNull();
    });

    it("B's status (the latest) landing first, then A's arriving late, resolves A but does not " +
       "touch B's already-shown message", () => {
      const disposeA = queueForRequest("req-a");
      const disposeB = queueForRequest("req-b");
      manager.setLatestIdeasRequestId("req-b");

      manager.applyEvaluationStatus({ outcome: "skipped-empty", requestId: "req-b", docUpdated: 2, completedAt: 2 });
      expect(disposeB).toHaveBeenCalled();
      expect(manager.statusMessage).toMatchObject({ message: IDEAS_EMPTY_MESSAGE });
      const statusMessageAfterB = manager.statusMessage;

      // A different outcome than B's, so an overwrite would show as the wrong message, not
      // coincidentally the same one.
      manager.applyEvaluationStatus({ outcome: "failed", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.pendingComments).toHaveLength(0);
      expect(disposeA).toHaveBeenCalled();
      // Same object, not just an equal-looking one: B's message was never touched.
      expect(manager.statusMessage).toBe(statusMessageAfterB);
    });

    it("shows no nudge when A's status lands while B is still waiting for its save (B's entry not yet queued)", () => {
      queueForRequest("req-a");
      manager.setLatestIdeasRequestId("req-b");

      manager.applyEvaluationStatus({ outcome: "skipped-empty", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.statusMessage).toBeNull();
    });

    it("shows no nudge for a skipped-empty on an older request, arriving after the latest has already resolved", () => {
      queueForRequest("req-a");
      queueForRequest("req-b", () => true); // resolves as soon as checkPendingComments runs
      manager.setLatestIdeasRequestId("req-b");

      manager.checkPendingComments();
      expect(manager.pendingComments.some(p => (p as any).requestId === "req-b")).toBe(false);

      manager.applyEvaluationStatus({ outcome: "skipped-empty", requestId: "req-a", docUpdated: 1, completedAt: 1 });

      expect(manager.statusMessage).toBeNull();
    });
  });

  describe("expiry", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("removes an entry with no signal after 120s, calls dispose, and releases a queued local comment", async () => {
      jest.useFakeTimers();

      const dispose = jest.fn();
      manager.queueRemoteComment({ triggeredAt: Date.now(), source: "ai", checkCompleted: () => false, dispose });

      const postFunction = jest.fn().mockResolvedValue({ id: "ex1" });
      manager.queueComment({
        comment: { content: "test", linkedDocumentKey: "ex1" },
        context: { classHash: "c1", appMode: "test" },
        document: { uid: "u1", type: "problem", key: "d1" },
        source: "exemplar",
        postFunction
      });

      expect(postFunction).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(120_000);

      expect(manager.pendingComments).toHaveLength(0);
      expect(dispose).toHaveBeenCalled();
      expect(postFunction).toHaveBeenCalled();
    });
  });
});
