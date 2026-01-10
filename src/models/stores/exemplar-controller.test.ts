import { Instance } from "mobx-state-tree";
import { BaseDocumentContentModel } from "../document/base-document-content";
import { ExemplarControllerModel, IExemplarControllerStores } from "./exemplar-controller";

const mockPostExemplarComment = jest.fn().mockResolvedValue({ data: { id: "comment123" } });
jest.mock("firebase/app", () => ({
  functions: () => ({
    httpsCallable: jest.fn(() => mockPostExemplarComment)
  })
}));

jest.mock("../../lib/logger", () => ({
  Logger: {
    Instance: {
      registerLogListener: jest.fn()
    }
  }
}));

describe("ExemplarControllerModel", () => {
  let mockDocumentContent: Instance<typeof BaseDocumentContentModel>;
  let exemplarController: Instance<typeof ExemplarControllerModel>;
  let mockStores: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockDocumentContent = BaseDocumentContentModel.create({
      tileMap: {},
      sharedModelMap: {}
    });

    jest.spyOn(mockDocumentContent, "queueExemplarComment");

    mockStores = {
      appConfig: {
        aiEvaluation: false,
        initiallyHideExemplars: true
      },
      db: {
        firebase: {
          getUserExemplarsPath: jest.fn(() => "user/exemplars/path"),
          getExemplarStatePath: jest.fn(() => "user/exemplars/state"),
          ref: jest.fn(() => ({
            once: jest.fn(() => Promise.resolve({ val: jest.fn(() => null) })),
            set: jest.fn(),
            child: jest.fn(() => ({
              set: jest.fn()
            }))
          }))
        }
      },
      documents: {
        getDocument: jest.fn(() => ({
          metadata: { uid: "user1", type: "problem", key: "doc1" },
          content: mockDocumentContent
        })),
        invisibleExemplarDocuments: [{ key: "exemplar1" }]
      },
      persistentUI: {
        openResourceDocument: jest.fn(),
        problemWorkspace: { primaryDocumentKey: "current-doc" },
        toggleShowChatPanel: jest.fn()
      },
      ui: { clearSelectedTiles: jest.fn() },
      user: { uid: "user1" },
      userContextProvider: {
        userContext: { classHash: "class1", uid: "user1" }
      }
    };

    exemplarController = ExemplarControllerModel.create({});
    await exemplarController.initialize(mockStores as IExemplarControllerStores);
  });

  describe("Comment Coordination", () => {
    it("should post exemplar comments immediately when AI evaluation is disabled", () => {
      mockStores.appConfig.aiEvaluation = false;

      exemplarController.showRandomExemplar();

      expect(mockDocumentContent.queueExemplarComment).not.toHaveBeenCalled();
      expect(mockPostExemplarComment).toHaveBeenCalledWith({
        document: { uid: "user1", type: "problem", key: "doc1" },
        comment: {
          content: "See if this example gives you any new ideas:",
          linkedDocumentKey: "exemplar1"
        },
        context: { classHash: "class1", uid: "user1" }
      });
      expect(mockStores.persistentUI.openResourceDocument).toHaveBeenCalled();
      expect(mockStores.persistentUI.toggleShowChatPanel).toHaveBeenCalledWith(true);
    });

    it("should queue exemplar comments when AI evaluation is enabled and analysis is pending", () => {
      mockStores.appConfig.aiEvaluation = true;
      mockDocumentContent.setAwaitingAIAnalysis(true);

      exemplarController.showRandomExemplar();

      expect(mockDocumentContent.queueExemplarComment).toHaveBeenCalledWith({
        comment: {
          content: "See if this example gives you any new ideas:",
          linkedDocumentKey: "exemplar1"
        },
        document: { uid: "user1", type: "problem", key: "doc1" },
        context: { classHash: "class1", uid: "user1" },
        postFunction: expect.any(Function)
      });
      expect(mockPostExemplarComment).not.toHaveBeenCalled();
      expect(mockStores.persistentUI.openResourceDocument).toHaveBeenCalled();
      expect(mockStores.persistentUI.toggleShowChatPanel).toHaveBeenCalledWith(true);
    });

    it("should post exemplar comment immediately when AI evaluation is enabled but analysis is not pending", () => {
      mockStores.appConfig.aiEvaluation = true;
      mockDocumentContent.setAwaitingAIAnalysis(false);

      exemplarController.showRandomExemplar();

      expect(mockDocumentContent.queueExemplarComment).not.toHaveBeenCalled();
      expect(mockPostExemplarComment).toHaveBeenCalledWith({
        document: { uid: "user1", type: "problem", key: "doc1" },
        comment: {
          content: "See if this example gives you any new ideas:",
          linkedDocumentKey: "exemplar1"
        },
        context: { classHash: "class1", uid: "user1" }
      });
      expect(mockStores.persistentUI.openResourceDocument).toHaveBeenCalled();
      expect(mockStores.persistentUI.toggleShowChatPanel).toHaveBeenCalledWith(true);
    });

    it("should handle post exemplar comment function errors gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const testError = new Error("Firebase posting failed");

      mockPostExemplarComment.mockRejectedValueOnce(testError);
      mockStores.appConfig.aiEvaluation = false;
      exemplarController.showRandomExemplar();

      expect(mockPostExemplarComment).toHaveBeenCalledWith({
        document: { uid: "user1", type: "problem", key: "doc1" },
        comment: {
          content: "See if this example gives you any new ideas:",
          linkedDocumentKey: "exemplar1"
        },
        context: { classHash: "class1", uid: "user1" }
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to post exemplar comment:", testError);
      expect(mockStores.persistentUI.openResourceDocument).toHaveBeenCalled();
      expect(mockStores.persistentUI.toggleShowChatPanel).toHaveBeenCalledWith(true);

      consoleErrorSpy.mockRestore();
    });
  });
});
