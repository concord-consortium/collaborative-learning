import { Instance } from "mobx-state-tree";
import { BaseDocumentContentModel } from "./base-document-content";
import { IClientCommentParams, IDocumentMetadata, IUserContext } from "../../../shared/shared";

describe("BaseDocumentContentModel", () => {
  let documentContent: Instance<typeof BaseDocumentContentModel>;

  beforeEach(() => {
    documentContent = BaseDocumentContentModel.create({
      sharedModelMap: {},
      tileMap: {}
    });
  });

  describe("awaitingAIAnalysis", () => {
    it("should manage awaitingAIAnalysis flag", () => {
      expect(documentContent.awaitingAIAnalysis).toBe(false);

      documentContent.setAwaitingAIAnalysis(true);
      expect(documentContent.awaitingAIAnalysis).toBe(true);

      documentContent.setAwaitingAIAnalysis(false);
      expect(documentContent.awaitingAIAnalysis).toBe(false);
    });
  });

  describe("Exemplar Comment Coordination", () => {
    const basicCommentData = {
      comment: {
        content: "See if this example gives you any new ideas:",
        linkedDocumentKey: "exemplar-doc-123"
      } as IClientCommentParams,
      context: { classHash: "class1" } as IUserContext,
      document: { uid: "user1", type: "problem", key: "doc1" } as IDocumentMetadata,
      postFunction: jest.fn().mockResolvedValue({ data: { id: "comment1" } })
    };

    const secondCommentData = {
      comment: {
        content: "See if this example gives you any new ideas:",
        linkedDocumentKey: "exemplar-doc-456"
      } as IClientCommentParams,
      context: { classHash: "class2" } as IUserContext,
      document: { uid: "user2", type: "problem", key: "doc2" } as IDocumentMetadata,
      postFunction: jest.fn().mockResolvedValue({ data: { id: "comment2" } })
    };

    const invalidCommentData = {
      comment: {
        content: "See if this example gives you any new ideas:",
        linkedDocumentKey: "exemplar-invalid-doc"
      } as IClientCommentParams,
      context: { classHash: "class1" } as IUserContext,
      document: { uid: "user1", type: "problem", key: "doc1" } as IDocumentMetadata,
      postFunction: jest.fn().mockRejectedValue(new Error("Post failed"))
    };

    describe("queueExemplarComment", () => {
      it("should add comment to pending queue", () => {
        documentContent.queueExemplarComment(basicCommentData);

        expect(documentContent.pendingExemplarComments).toHaveLength(1);
        expect(documentContent.pendingExemplarComments[0]).toEqual(basicCommentData);
      });

      it("should allow multiple comments to be queued", () => {
        documentContent.queueExemplarComment(basicCommentData);
        documentContent.queueExemplarComment(secondCommentData);

        expect(documentContent.pendingExemplarComments).toHaveLength(2);
      });
    });

    describe("postQueuedExemplarComments", () => {
      it("should post all queued comments and clear queue", async () => {
        documentContent.queueExemplarComment(basicCommentData);
        documentContent.queueExemplarComment(secondCommentData);

        await documentContent.postQueuedExemplarComments();

        expect(basicCommentData.postFunction).toHaveBeenCalledWith({
          document: basicCommentData.document,
          comment: basicCommentData.comment,
          context: basicCommentData.context
        });
        expect(secondCommentData.postFunction).toHaveBeenCalledWith({
          document: secondCommentData.document,
          comment: secondCommentData.comment,
          context: secondCommentData.context
        });
        expect(documentContent.pendingExemplarComments).toHaveLength(0);
      });

      it("should handle errors gracefully and still clear queue", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
        documentContent.queueExemplarComment(invalidCommentData);

        await documentContent.postQueuedExemplarComments();

        expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to post queued exemplar comment:", expect.any(Error));
        expect(documentContent.pendingExemplarComments).toHaveLength(0);
        expect(invalidCommentData.postFunction).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });

      it("should handle empty queue gracefully", async () => {
        expect(documentContent.pendingExemplarComments).toHaveLength(0);

        await expect(documentContent.postQueuedExemplarComments()).resolves.not.toThrow();

        expect(documentContent.pendingExemplarComments).toHaveLength(0);
      });

      it("should handle mixed success/failure scenarios", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
        documentContent.queueExemplarComment(basicCommentData);
        documentContent.queueExemplarComment(invalidCommentData);
        documentContent.queueExemplarComment(secondCommentData);

        await documentContent.postQueuedExemplarComments();

        expect(basicCommentData.postFunction).toHaveBeenCalled();
        expect(invalidCommentData.postFunction).toHaveBeenCalled();
        expect(secondCommentData.postFunction).toHaveBeenCalled();

        // Should log only the one error.
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to post queued exemplar comment:", expect.any(Error));

        // Queue should be completely cleared even with mixed results.
        expect(documentContent.pendingExemplarComments).toHaveLength(0);

        consoleErrorSpy.mockRestore();
      });
    });
  });
});
