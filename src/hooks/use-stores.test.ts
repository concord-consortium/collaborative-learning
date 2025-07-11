import { ProblemModel } from "../models/curriculum/problem";
import { AppConfigModel } from "../models/stores/app-config-model";
import { ClassModel } from "../models/stores/class";
import { DemoClassModel, DemoModel } from "../models/stores/demo";
import { DocumentsModel } from "../models/stores/documents";
import { GroupsModel } from "../models/stores/groups";
import { SelectionStoreModel } from "../models/stores/selection";
import { UserModel } from "../models/stores/user";
import {
  LearningLogWorkspace, ProblemWorkspace, WorkspaceModel,
} from "../models/stores/workspace";
import {
  useAppConfig, useAppMode, useClassStore, useDemoStore, useDocumentFromStore, useDocumentMetadataFromStore,
  useDocumentOrCurriculumMetadata, useGroupsStore, useLocalDocuments, useNetworkDocumentKey, useNetworkDocuments,
  useProblemPath, useProblemPathWithFacet, useProblemStore, useSharedSelectionStore,
  useTypeOfTileInDocumentOrCurriculum, usePersistentUIStore, useUserStore, useUIStore
} from "./use-stores";
import { unitConfigDefaults } from "../test-fixtures/sample-unit-configurations";
import { UIModel } from "../models/stores/ui";
import { PersistentUIModel } from "../models/stores/persistent-ui/persistent-ui";

jest.mock("@concord-consortium/slate-editor", () => ({
    registerElementComponent: jest.fn(),
}));

const mockUseContext = jest.fn();
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: () => mockUseContext(),
  useMemo: (fn: () => any) => fn()
}));

describe("useStores", () => {
  function resetMocks() {
    mockUseContext.mockReset();
  }

  describe("simple store hooks", () => {
    beforeEach(() => resetMocks());
    it("should return the requested store", () => {
      const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
      const _class = ClassModel.create({ name: "Class 1", classHash: "hash-1" });
      const demo = DemoModel.create({ class: DemoClassModel.create({ id: "class-1", name: "Class 1" }) });
      const groups = GroupsModel.create();
      const localDocuments = DocumentsModel.create();
      const networkDocuments = DocumentsModel.create();
      const problemPath = "sas/1/2";
      const problemPathWithFacet = "sas:facet/1/2";
      const problem = ProblemModel.create({ ordinal: 2, title: "1.2" });
      const selection = SelectionStoreModel.create();
      const ui = UIModel.create({
        learningLogWorkspace: WorkspaceModel.create({ type: LearningLogWorkspace, mode: "1-up" })
      });
      const persistentUI = PersistentUIModel.create({
        problemWorkspace: WorkspaceModel.create({ type: ProblemWorkspace, mode: "4-up" })
      });
      const user = UserModel.create({ id: "id-1", network: "network-1" });
      mockUseContext.mockImplementation(() => ({
        stores: {
          appConfig,
          appMode: "authed",
          class: _class,
          demo,
          documents: localDocuments,
          groups,
          networkDocuments,
          problemPath,
          problem,
          selection,
          ui,
          persistentUI,
          user
        }
      }));
      expect(useAppConfig()).toBe(appConfig);
      expect(useAppMode()).toBe("authed");
      expect(useClassStore()).toBe(_class);
      expect(useDemoStore()).toBe(demo);
      expect(useGroupsStore()).toBe(groups);
      expect(useLocalDocuments()).toBe(localDocuments);
      expect(useNetworkDocuments()).toBe(networkDocuments);
      expect(useDocumentFromStore()).toBeUndefined();
      expect(useDocumentFromStore("foo")).toBeUndefined();
      expect(useDocumentMetadataFromStore("foo")).toBeUndefined();
      expect(useDocumentOrCurriculumMetadata("foo")).toBeUndefined();
      expect(useNetworkDocumentKey("document-key")).toBe("network-1_document-key");
      expect(useProblemPath()).toBe(problemPath);
      expect(useProblemPathWithFacet("facet")).toBe(problemPathWithFacet);
      expect(useProblemStore()).toBe(problem);
      expect(useSharedSelectionStore()).toBe(selection);
      expect(usePersistentUIStore()).toBe(persistentUI);
      expect(useUIStore()).toBe(ui);
      expect(useUserStore()).toBe(user);
    });
  });

  describe("useTypeOfTileInDocumentOrCurriculum", () => {
    beforeEach(() => resetMocks());

    it("should return undefined if specified document or tile doesn't exist", () => {
      mockUseContext.mockImplementation(() => ({
        stores: {
          documents: DocumentsModel.create()
        }
      }));
      expect(useTypeOfTileInDocumentOrCurriculum()).toBeUndefined();
      expect(useTypeOfTileInDocumentOrCurriculum("key")).toBeUndefined();
      expect(useTypeOfTileInDocumentOrCurriculum(undefined, "id")).toBeUndefined();
      expect(useTypeOfTileInDocumentOrCurriculum("key", "id")).toBeUndefined();
    });

    it("should return type of tile from tile id for curriculum documents", () => {
      mockUseContext.mockImplementation(() => ({
        stores: {
          documents: {
            getTypeOfTileInDocument: () => "Text"
          }
        }
      }));
      expect(useTypeOfTileInDocumentOrCurriculum("sas/1/2/introduction", "foo")).toBeUndefined();
      expect(useTypeOfTileInDocumentOrCurriculum("sas/1/2/introduction", "introduction_Text_1")).toBe("Text");
      expect(useTypeOfTileInDocumentOrCurriculum("sas/1/2/introduction", "introduction_Geometry_1")).toBe("Geometry");
    });

    it("should return type of tile from content for user documents", () => {
      mockUseContext.mockImplementation(() => ({
        stores: {
          documents: {
            getTypeOfTileInDocument: () => "Text"
          }
        }
      }));
      expect(useTypeOfTileInDocumentOrCurriculum("document-key", "tile-id")).toBe("Text");
    });

    it("should return type of tile from content for remote user documents", () => {
      mockUseContext.mockImplementation(() => ({
        stores: {
          documents: {
            getTypeOfTileInDocument: () => undefined
          },
          networkDocuments: {
            getTypeOfTileInDocument: () => "Text"
          }
        }
      }));
      expect(useTypeOfTileInDocumentOrCurriculum("document-key", "tile-id")).toBe("Text");
    });
  });

});
