import { applySnapshot, getSnapshot } from "@concord-consortium/mobx-state-tree";
import {
  PersistentUIModel, PersistentUIModelV1Snapshot, persistentUIModelPreProcessor,
  PersistentUIModelV2Snapshot, PersistentUIModelType, dividerForLayout, resolveStartView,
  applyStartupUIState
} from "./persistent-ui";
import { UITabModel } from "./ui-tab-model";
import { UIDocumentGroup } from "./ui-document-group";
import { ENavTab, NavTabModel, NavTabModelType } from "../../../models/view/nav-tabs";
import { kDividerMin, kDividerMax, kDividerHalf } from "../ui-types";

describe("PersistentUI", () => {
  describe("UIDocumentGroup", () => {
    it("starts with currentDocumentKeys undefined", () => {
      const group = UIDocumentGroup.create({id: "student-work"});
      expect(group.currentDocumentKeys).toBeUndefined();
    });
    it("handles an initial empty currentDocumentKeys", () => {
      const group = UIDocumentGroup.create({id: "student-work", currentDocumentKeys: []});
      expect(group.currentDocumentKeys).toEqual([]);
    });
    describe("setPrimaryDocumentKey", () => {
      it("will create the currentDocumentKeys", () => {
        const group = UIDocumentGroup.create({id: "student-work"});
        group.setPrimaryDocumentKey("1234");
        expect(group.currentDocumentKeys).toEqual(["1234"]);
      });
      it("will update the first document if it exists", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["initial"]
        });
        expect(group.currentDocumentKeys).toEqual(["initial"]);
        group.setPrimaryDocumentKey("1234");
        expect(group.currentDocumentKeys).toEqual(["1234"]);

        const group2 = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["initialPrimary", "initialSecondary"]
        });
        expect(group2.currentDocumentKeys).toEqual(["initialPrimary", "initialSecondary"]);
        group2.setPrimaryDocumentKey("1234");
        expect(group2.currentDocumentKeys).toEqual(["1234", "initialSecondary"]);
      });
    });
    describe("closePrimaryDocument", () => {
      it("works even if currentDocumentKeys is undefined", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
        });
        expect(group.currentDocumentKeys).toBeUndefined();
        group.closePrimaryDocument();
        expect(group.currentDocumentKeys).toEqual([]);
      });
      it("works if currentDocumentKeys is an empty array", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: []
        });
        expect(group.currentDocumentKeys).toEqual([]);
        group.closePrimaryDocument();
        expect(group.currentDocumentKeys).toEqual([]);
      });
      it("works when there is just a primaryDocument", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["initialDoc"]
        });
        group.closePrimaryDocument();
        expect(group.currentDocumentKeys).toEqual([]);
      });
      it("moves secondaryDocument to the primaryDocument", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["initialPrimaryDoc", "initialSecondaryDoc"]
        });
        group.closePrimaryDocument();
        expect(group.currentDocumentKeys).toEqual(["initialSecondaryDoc"]);
        expect(group.primaryDocumentKey).toBe("initialSecondaryDoc");
        expect(group.secondaryDocumentKey).toBeUndefined();
      });
    });
    describe("setSecondaryDocumentKey", () => {
      it("will create the currentDocumentKeys", () => {
        const group = UIDocumentGroup.create({id: "student-work"});
        group.setSecondaryDocumentKey("1234");
        // This is the current error handling approach where it just puts this as the
        // first document
        expect(group.currentDocumentKeys).toEqual(["1234"]);
      });
      it("will just make a primary document if there isn't one", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: []
        });
        group.setSecondaryDocumentKey("1234");
        // This is the current error handling approach where it just puts this as the
        // first document
        expect(group.currentDocumentKeys).toEqual(["1234"]);
      });
      it("will add the secondary document if there is only a primary document", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["primary"]
        });
        group.setSecondaryDocumentKey("1234");
        expect(group.currentDocumentKeys).toEqual(["primary", "1234"]);
      });
      it("will update the secondary document if it exists", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["primary", "secondary"]
        });
        group.setSecondaryDocumentKey("1234");
        expect(group.currentDocumentKeys).toEqual(["primary", "1234"]);
      });

    });
    describe("closeSecondaryDocument", () => {
      it("handles the case when currentDocumentKeys is undefined", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
        });
        expect(group.currentDocumentKeys).toBeUndefined();
        group.closeSecondaryDocument();
        expect(group.currentDocumentKeys).toBeUndefined();
      });
      it("handles the case when currentDocumentKeys is empty", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: []
        });
        group.closeSecondaryDocument();
        expect(group.currentDocumentKeys).toEqual([]);
      });
      it("handles the case when there is only a primaryDocumentKey", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["primaryDoc"]
        });
        group.closeSecondaryDocument();
        expect(group.currentDocumentKeys).toEqual(["primaryDoc"]);
      });
      it("removes secondary document from currentDocumentKeys", () => {
        const group = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["primaryDoc", "secondaryDoc"]
        });
        group.closeSecondaryDocument();
        expect(group.currentDocumentKeys).toEqual(["primaryDoc"]);
      });

    });
    describe("userExplicitlyClosedDocument", () => {
      it("works properly", () => {
        const group1 = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: undefined
        });
        expect(group1.userExplicitlyClosedDocument).toBe(false);

        const group2 = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: []
        });
        expect(group2.userExplicitlyClosedDocument).toBe(true);

        const group3 = UIDocumentGroup.create({
          id: "student-work",
          currentDocumentKeys: ["primaryDoc"]
        });
        expect(group3.userExplicitlyClosedDocument).toBe(false);
      });
    });
  });

  describe("UITabModel", () => {
    describe("setPrimaryDocumentInDocumentGroup", () => {
      it("will create a new document group", () => {
        const tab = UITabModel.create({id: "test"});
        expect([...tab.visitedDocumentGroups.keys()]).toEqual([]);
        expect(tab.currentDocumentGroup).toBeUndefined();
        tab.setDocumentGroupPrimaryDocument("testGroup", "1234");

        expect([...tab.visitedDocumentGroups.keys()]).toEqual(["testGroup"]);
        const visitedGroup = tab.visitedDocumentGroups.get("testGroup");
        expect(visitedGroup).toBeDefined();
        if (!visitedGroup) throw "Visited group undefined";

        const group = tab.currentDocumentGroup;
        expect(group).toBeUndefined();

        expect(visitedGroup.id).toBe("testGroup");
      });

      it("will update a existing document group", () => {
        const tab = UITabModel.create({
          id: "test",
          visitedDocumentGroups: {
            testGroup: {
              id: "testGroup"
            }
          }
        });
        const visitedGroup = tab.visitedDocumentGroups.get("testGroup");
        expect(visitedGroup).toBeDefined();
        if (!visitedGroup) throw "Visited group undefined";
        expect(visitedGroup.id).toBe("testGroup");
        expect(visitedGroup.primaryDocumentKey).toBeUndefined();

        tab.setDocumentGroupPrimaryDocument("testGroup", "1234");

        expect([...tab.visitedDocumentGroups.keys()]).toEqual(["testGroup"]);
        expect(visitedGroup.primaryDocumentKey).toBe("1234");
      });
    });
    describe("setSecondaryDocumentInDocumentGroup", () => {
      it("will create a new document group", () => {
        const tab = UITabModel.create({id: "test"});
        expect([...tab.visitedDocumentGroups.keys()]).toEqual([]);
        expect(tab.currentDocumentGroup).toBeUndefined();
        tab.setDocumentGroupSecondaryDocument("testGroup", "1234");

        // Error handling: just put the document as the primary document
        expect([...tab.visitedDocumentGroups.keys()]).toEqual(["testGroup"]);
        const visitedGroup = tab.visitedDocumentGroups.get("testGroup");
        expect(visitedGroup).toBeDefined();
        if (!visitedGroup) throw "Visited group undefined";
        const group = tab.currentDocumentGroup;
        expect(group).toBeUndefined();
        expect(visitedGroup.id).toBe("testGroup");
      });
      it("will update a existing document group", () => {
        const tab = UITabModel.create({
          id: "test",
          visitedDocumentGroups: {
            testGroup: {
              id: "testGroup",
              currentDocumentKeys: ["primary"]
            }
          }
        });
        const visitedGroup = tab.visitedDocumentGroups.get("testGroup");
        expect(visitedGroup).toBeDefined();
        if (!visitedGroup) throw "Visited group undefined";
        expect(visitedGroup.id).toBe("testGroup");

        tab.setDocumentGroupSecondaryDocument("testGroup", "1234");

        expect([...tab.visitedDocumentGroups.keys()]).toEqual(["testGroup"]);
        expect(visitedGroup.secondaryDocumentKey).toBe("1234");
      });

    });
  });

  describe("closeDocumentGroupPrimaryDocument", () => {
    it("saves the users intention", () => {
      const ui = PersistentUIModel.create({
        version: "2.0.0",
        tabs: {
          test: {
            id: "test",
            currentDocumentGroupId: "testSubTab"
          }
        },
        activeNavTab: "test",
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      });
      expect(ui.tabs.get("test")?.currentDocumentGroup?.userExplicitlyClosedDocument).toBeFalsy();
      ui.closeDocumentGroupPrimaryDocument();
      expect(ui.tabs.get("test")?.currentDocumentGroup?.userExplicitlyClosedDocument).toBe(true);
    });
  });

  describe("initializeActiveNavTab", () => {
    let ui: PersistentUIModelType;
    let tabSpecs: NavTabModelType[];
    beforeEach(() => {
      ui = PersistentUIModel.create({
        version: "2.0.0",
        tabs: {
          test: {
            id: "test",
          }
        },
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      });
      tabSpecs = [
        NavTabModel.create({
          tab: ENavTab.kProblems,
          label: "Problems"
        }),
        NavTabModel.create({
          tab: ENavTab.kClassWork,
          label: "ClassWork"
        })
      ];
    });

    it("sets the active tab to the first tab", () => {
      expect(ui.activeNavTab).toBeUndefined();
      ui.initializeActiveNavTab(tabSpecs);
      expect(ui.activeNavTab).toBe(ENavTab.kProblems);
    });
    it("doesn't change the active tab if it is already set", () => {
      ui.setActiveNavTab(ENavTab.kClassWork);
      ui.initializeActiveNavTab(tabSpecs);
      expect(ui.activeNavTab).toBe(ENavTab.kClassWork);
    });
    it("sets the active tab to the first tab if the current active tab doesn't exist", () => {
      ui.setActiveNavTab("foo");
      ui.initializeActiveNavTab(tabSpecs);
      expect(ui.activeNavTab).toBe(ENavTab.kProblems);
    });
  });

  describe("openResourceDocument", () => {
    let persistentUI: PersistentUIModelType;
    let mockAppConfig: any;
    let mockUser: any;
    let mockSortedDocuments: any;
    let mockDoc: any;

    beforeEach(() => {
      persistentUI = PersistentUIModel.create({
        problemWorkspace: { type: "problem", mode: "1-up" }
      });

      mockUser = { id: "student1", isTeacherOrResearcher: false };
      mockSortedDocuments = { sortBy: jest.fn().mockReturnValue([]) };
      mockDoc = {
        key: "doc1",
        type: "problem",
        // A problem document is its author's, so its group affiliation is the author's group.
        groupIdOfUserOwner: "group1",
        uid: "student1",
        toJSON: () => ({ key: "doc1", type: "problem", groupIdOfUserOwner: "group1" })
      };
    });

    describe("AI evaluation tab preference", () => {
      it("prefers Sort Work when AI is enabled and Sort Work tab exists", () => {
        mockAppConfig = {
          aiEvaluation: "mock",
          navTabs: {
            tabSpecs: [
              { tab: "sort-work", label: "Sort Work" },
              { tab: "my-work", label: "My Work" }
            ]
          }
        };

        persistentUI.openResourceDocument(mockDoc, mockAppConfig, mockUser, mockSortedDocuments);

        expect(persistentUI.activeNavTab).toBe("sort-work");
      });

      it("falls back to My Work when AI is enabled but Sort Work tab not available", () => {
        mockAppConfig = {
          aiEvaluation: "mock",
          navTabs: {
            tabSpecs: [
              { tab: "my-work", label: "My Work" }
            ]
          }
        };

        persistentUI.openResourceDocument(mockDoc, mockAppConfig, mockUser, mockSortedDocuments);

        expect(persistentUI.activeNavTab).toBe("my-work");
      });

      it("uses document-based fallback when AI is disabled", () => {
        mockAppConfig = {
          aiEvaluation: undefined,
          navTabs: {
            tabSpecs: [
              { tab: ENavTab.kMyWork, label: "My Work" }
            ]
          }
        };

        persistentUI.openResourceDocument(mockDoc, mockAppConfig, mockUser, mockSortedDocuments);

        expect(persistentUI.activeNavTab).toBe(ENavTab.kMyWork);
      });
    });

    describe("URL student document handling", () => {
      it("routes a report link to Sort Work when the doc's group is unavailable, sorted by Name", () => {
        // aiEvaluation is intentionally undefined to prove the Sort Work routing and
        // the Name sort come from the report-link path itself, not from aiEvaluation.
        mockAppConfig = {
          aiEvaluation: undefined,
          navTabs: {
            tabSpecs: [
              { tab: "sort-work", label: "Sort Work" },
              { tab: "my-work", label: "My Work" },
              { tab: "student-work", label: "Student Work" }
            ]
          }
        };

        // Without hasStudentWorkGroup, student-work would render blank (its group
        // content loads async), so the report link falls back to Sort Work.
        persistentUI.openResourceDocument(
          mockDoc,
          mockAppConfig,
          mockUser,
          mockSortedDocuments,
          { fromUrlStudentDocument: true }
        );

        expect(persistentUI.activeNavTab).toBe(ENavTab.kSortWork);
        expect(persistentUI.primarySortBy).toBe("Name");
      });

      it("routes to Student Work when the doc's group is available to the viewer", () => {
        mockAppConfig = {
          aiEvaluation: undefined,
          navTabs: {
            tabSpecs: [
              { tab: "sort-work", label: "Sort Work" },
              { tab: "my-work", label: "My Work" },
              { tab: "student-work", label: "Student Work" }
            ]
          }
        };

        // With the doc's group available, Student Work can render, so a teacher
        // report link opens there rather than falling back to Sort Work.
        persistentUI.openResourceDocument(
          mockDoc,
          mockAppConfig,
          mockUser,
          mockSortedDocuments,
          { fromUrlStudentDocument: true, hasStudentWorkGroup: true }
        );

        expect(persistentUI.activeNavTab).toBe(ENavTab.kStudentWork);
      });

      it("does not route to student-work when that tab is hidden, even with the group available", () => {
        // The mods unit hides its student-work tab and exposes sort-work as the
        // visible "Class Work" tab. Routing to the hidden student-work tab leaves
        // displayedActiveNavTab falling back to the first tab, so the doc never shows.
        mockAppConfig = {
          aiEvaluation: undefined,
          navTabs: {
            tabSpecs: [
              { tab: "sort-work", label: "Class Work" },
              { tab: "my-work", label: "My Work" },
              { tab: "student-work", label: "Student Work", hidden: true }
            ]
          }
        };

        persistentUI.openResourceDocument(
          mockDoc,
          mockAppConfig,
          mockUser,
          mockSortedDocuments,
          { fromUrlStudentDocument: true, hasStudentWorkGroup: true }
        );

        expect(persistentUI.activeNavTab).toBe(ENavTab.kSortWork);
      });

      it("does not force student-work when Sort Work is unavailable (uses the doc's natural tab)", () => {
        mockAppConfig = {
          aiEvaluation: undefined,
          navTabs: {
            tabSpecs: [
              { tab: "my-work", label: "My Work" }
            ]
          }
        };
        // With Sort Work absent, the report-link flag no longer hard-codes
        // student-work; the doc routes to its natural tab (a problem doc -> my-work).
        persistentUI.openResourceDocument(
          mockDoc,
          mockAppConfig,
          mockUser,
          mockSortedDocuments,
          { fromUrlStudentDocument: true }
        );

        expect(persistentUI.activeNavTab).toBe(ENavTab.kMyWork);
      });

      it("substitutes Sort Work on the doc-based path when the natural tab is hidden", () => {
        // No fromUrlStudentDocument flag: a teacher/researcher opening another
        // student's problem doc (e.g. from a comment) resolves to student-work via
        // getNavTabOfDocument. When that tab is hidden (mods), route to the visible
        // Sort Work tab instead of the hidden one.
        mockUser = { id: "teacher1", isTeacherOrResearcher: true };
        mockAppConfig = {
          aiEvaluation: undefined,
          navTabs: {
            tabSpecs: [
              { tab: "sort-work", label: "Class Work" },
              { tab: "my-work", label: "My Work" },
              { tab: "student-work", label: "Student Work", hidden: true }
            ]
          }
        };

        persistentUI.openResourceDocument(mockDoc, mockAppConfig, mockUser, mockSortedDocuments);

        expect(persistentUI.activeNavTab).toBe(ENavTab.kSortWork);
      });
    });
  });

  describe("migration from V1", () => {
    it("can load a basic V1 snapshot", () => {
      const snapshot: PersistentUIModelV1Snapshot = {
        version: "1.0.0",
        tabs: {},
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        },
        showChatPanel: true
      };
      const ui = PersistentUIModel.create(snapshot as unknown as PersistentUIModelV2Snapshot);
      expect(ui.version).toBe("2.0.0");
      expect(ui.showChatPanel).toBe(true);
    });
    it("converts the openSubTab from the snapshot", () => {
      const snapshot: PersistentUIModelV1Snapshot = {
        version: "1.0.0",
        tabs: {
          test: {
            id: "test",
            openSubTab: "testSubTab",
            openDocuments: {},
            openSecondaryDocuments: {}
          }
        },
        activeNavTab: "test",
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      };
      const ui = PersistentUIModel.create(snapshot as unknown as PersistentUIModelV2Snapshot);
      expect(ui.version).toBe("2.0.0");
      expect(ui.tabs.get("test")?.currentDocumentGroupId).toBe("testSubTab");
      expect(ui.currentDocumentGroupId).toBe("testSubTab");
    });
    it("converts the openDocuments from the snapshot", () => {
      const snapshot: PersistentUIModelV1Snapshot = {
        version: "1.0.0",
        tabs: {
          test: {
            id: "test",
            openSubTab: "testSubTab1",
            openDocuments: {
              testSubTab1: "doc1",
              testSubTab2: "doc2"
            },
            openSecondaryDocuments: {}
          }
        },
        activeNavTab: "test",
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      };
      const ui = PersistentUIModel.create(snapshot as unknown as PersistentUIModelV2Snapshot);
      const migrated = getSnapshot(ui);
      expect(migrated).toMatchObject({
        version: "2.0.0",
        tabs: {
          test: {
            id: "test",
            currentDocumentGroupId: "testSubTab1",
            visitedDocumentGroups: {
              testSubTab1: {
                id: "testSubTab1",
                currentDocumentKeys: ["doc1"]
              },
              testSubTab2: {
                id: "testSubTab2",
                currentDocumentKeys: ["doc2"]
              }
            },
          }
        },
        activeNavTab: "test",
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      });
      expect(ui.currentDocumentGroupId).toBe("testSubTab1");

      const tabModel = ui.activeTabModel;
      expect(tabModel).toBeDefined();
      if (!tabModel) throw "tabModel is undefined";

      expect(tabModel.currentDocumentGroup).toBeDefined();
      expect(tabModel.currentDocumentGroup?.primaryDocumentKey).toBe("doc1");
      expect(tabModel.getDocumentGroupPrimaryDocument("testSubTab2")).toBe("doc2");
      expect([...tabModel.visitedDocumentGroups.keys()]).toEqual(["testSubTab1", "testSubTab2"]);
    });
    it("converts the openSecondaryDocuments from the snapshot", () => {
      const snapshot: PersistentUIModelV1Snapshot = {
        version: "1.0.0",
        tabs: {
          test: {
            id: "test",
            openSubTab: "testSubTab1",
            openDocuments: {
              testSubTab1: "doc1",
              testSubTab2: "doc2"
            },
            openSecondaryDocuments: {
              testSubTab1: "doc3",
              testSubTab3: "doc4"
            }
          }
        },
        activeNavTab: "test",
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      };
      const ui = PersistentUIModel.create(snapshot as unknown as PersistentUIModelV2Snapshot);
      const migrated = getSnapshot(ui);
      expect(migrated).toMatchObject({
        version: "2.0.0",
        tabs: {
          test: {
            id: "test",
            currentDocumentGroupId: "testSubTab1",
            visitedDocumentGroups: {
              testSubTab1: {
                id: "testSubTab1",
                currentDocumentKeys: ["doc1", "doc3"]
              },
              testSubTab2: {
                id: "testSubTab2",
                currentDocumentKeys: ["doc2"]
              },
              testSubTab3: {
                id: "testSubTab3",
                currentDocumentKeys: ["doc4"]
              }
            },
          }
        },
        activeNavTab: "test",
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      });
      expect(ui.currentDocumentGroupId).toBe("testSubTab1");

      const tabModel = ui.activeTabModel;
      expect(tabModel).toBeDefined();
      if (!tabModel) throw "tabModel is undefined";

      expect(tabModel.currentDocumentGroup).toBeDefined();
      expect(tabModel.currentDocumentGroup?.primaryDocumentKey).toBe("doc1");
      expect(tabModel.currentDocumentGroup?.secondaryDocumentKey).toBe("doc3");
      expect(tabModel.getDocumentGroupPrimaryDocument("testSubTab2")).toBe("doc2");
      expect([...tabModel.visitedDocumentGroups.keys()]).toEqual(["testSubTab1", "testSubTab2", "testSubTab3"]);
    });
    it("converts real version 1 state", () => {
      const realV1State: PersistentUIModelV1Snapshot = {
        "dividerPosition": 50,
        "activeNavTab": "problems",
        "docFilter": "Problem",
        "primarySortBy": "Group",
        "secondarySortBy": "None",
        "showAnnotations": true,
        "showTeacherContent": true,
        "showChatPanel": true,
        "showDocumentScroller": true,
        "tabs": {
            "problems": {
                "id": "problems",
                "openSubTab": "introduction",
                "openDocuments": {},
                "openSecondaryDocuments": {}
            },
            "teacher-guide": {
                "id": "teacher-guide",
                "openSubTab": "launch",
                "openDocuments": {},
                "openSecondaryDocuments": {}
            },
            "my-work": {
                "id": "my-work",
                "openSubTab": "Workspaces",
                "openDocuments": {},
                "openSecondaryDocuments": {}
            }
        },
        "problemWorkspace": {
            "type": "problem",
            "mode": "1-up",
            "primaryDocumentKey": "-OJdBCDm6Pq-zdpzVTPP",
            "comparisonVisible": false,
            "hidePrimaryForCompare": false
        },
        "version": "1.0.0"
      };
      const ui = PersistentUIModel.create({
        version: "2.0.0",
        tabs: {},
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      });
      // Below is a test for broken MST behavior: applySnapshot does not run the snapshot
      // preprocessor when types.snapshotProcessor is used:
      // https://github.com/mobxjs/mobx-state-tree/issues/1317
      // So the test expects applySnapshot to throw an exception.
      // The runtime code works around this by explicitly migrating the snapshot before
      // calling applySnapshot. This behavior is emulated on the next line.
      // If the MST bug is fixed, then we should remove the explicit migration of the
      // snapshot.
      expect(() => applySnapshot(ui, realV1State as unknown)).toThrow();

      const migratedSnapshot = persistentUIModelPreProcessor(realV1State as unknown);
      applySnapshot(ui, migratedSnapshot);


      expect(ui.version).toBe("2.0.0");
    });
  });

  describe("applyDefaultPanelLayout", () => {
    it("sets divider to kDividerMin for workspace-only when no saved state", () => {
      const model = PersistentUIModel.create({ problemWorkspace: { type: "problem", mode: "1-up" } });
      model.applyDefaultPanelLayout("workspace-only");
      expect(model.dividerPosition).toBe(kDividerMin);
    });

    it("sets divider to kDividerMax for resources-only when no saved state", () => {
      const model = PersistentUIModel.create({ problemWorkspace: { type: "problem", mode: "1-up" } });
      model.applyDefaultPanelLayout("resources-only");
      expect(model.dividerPosition).toBe(kDividerMax);
    });

    it("keeps kDividerHalf for split when no saved state", () => {
      const model = PersistentUIModel.create({ problemWorkspace: { type: "problem", mode: "1-up" } });
      model.applyDefaultPanelLayout("split");
      expect(model.dividerPosition).toBe(kDividerHalf);
    });

    it("keeps kDividerHalf for undefined when no saved state", () => {
      const model = PersistentUIModel.create({ problemWorkspace: { type: "problem", mode: "1-up" } });
      model.applyDefaultPanelLayout(undefined);
      expect(model.dividerPosition).toBe(kDividerHalf);
    });

    it("does not change divider when saved state exists", () => {
      const model = PersistentUIModel.create({ problemWorkspace: { type: "problem", mode: "1-up" } });
      model.setHasSavedPersistentUI(true);
      model.applyDefaultPanelLayout("workspace-only");
      expect(model.dividerPosition).toBe(kDividerHalf);
    });
  });

  describe("applyFixedStartView", () => {
    // A returning user whose state was restored from Firebase, with a two-key group (primary +
    // secondary) open in another tab: exactly the shape the old close-primary approach mishandled.
    function makeSavedUI() {
      const ui = PersistentUIModel.create({
        version: "2.0.0",
        tabs: {
          "class-work": {
            id: "class-work",
            currentDocumentGroupId: "Workspaces",
            visitedDocumentGroups: { Workspaces: { id: "Workspaces", currentDocumentKeys: ["doc-1", "doc-2"] } }
          }
        },
        activeNavTab: "my-work",
        dividerPosition: kDividerMax,
        problemWorkspace: { type: "problem", mode: "1-up" }
      });
      ui.setHasSavedPersistentUI(true);
      return ui;
    }

    it("overrides the displayed tab and divider without mutating the saved record", () => {
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);

      // The override drives the display...
      expect(ui.displayedNavTab).toBe(ENavTab.kClassWork);
      expect(ui.displayedDividerPosition).toBe(kDividerHalf);
      // ...but the persisted state is untouched, so the user's real place survives.
      expect(ui.activeNavTab).toBe("my-work");
      expect(ui.dividerPosition).toBe(kDividerMax);
      expect(ui.tabs.get("class-work")?.getDocumentGroup("Workspaces")?.currentDocumentKeys)
        .toEqual(["doc-1", "doc-2"]);
    });

    it("releases the forced tab when the user chooses a tab", () => {
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      ui.setActiveNavTab(ENavTab.kSortWork);
      expect(ui.isStartViewOverrideActiveFor(ENavTab.kClassWork)).toBe(false);
      expect(ui.displayedNavTab).toBe(ENavTab.kSortWork);
      expect(ui.activeNavTab).toBe(ENavTab.kSortWork);
    });

    it("keeps the forced divider when the user navigates", () => {
      // The saved divider has the resources pane closed. Releasing the divider along with the tab
      // would collapse the panel on the user's first click, hiding what they just opened.
      const ui = PersistentUIModel.create({
        version: "2.0.0",
        activeNavTab: "my-work",
        dividerPosition: kDividerMin,
        problemWorkspace: { type: "problem", mode: "1-up" }
      });
      ui.setHasSavedPersistentUI(true);
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      expect(ui.navTabContentShown).toBe(true);

      ui.setActiveNavTab(ENavTab.kClassWork);
      expect(ui.displayedDividerPosition).toBe(kDividerHalf);
      expect(ui.navTabContentShown).toBe(true);
      // The saved divider is untouched by the override itself; a resize overwrites it with whatever
      // the user picks (here the same value they had saved).
      expect(ui.dividerPosition).toBe(kDividerMin);
    });

    it("releases the forced divider, but not the forced tab, when the user resizes", () => {
      // Resizing the pane (or collapsing it, or following the skip link) is not a request to go to a
      // different tab, so the panel must not swap its content underneath the resize.
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      ui.setDividerPosition(kDividerMin);
      expect(ui.displayedDividerPosition).toBe(kDividerMin);
      expect(ui.startViewDividerPosition).toBeUndefined();
      expect(ui.isStartViewOverrideActiveFor(ENavTab.kClassWork)).toBe(true);
      expect(ui.displayedNavTab).toBe(ENavTab.kClassWork);
      // The saved divider is written as usual; only the forced value is dropped.
      expect(ui.dividerPosition).toBe(kDividerMin);
    });

    it("releases the forced tab when the user opens a document", () => {
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      ui.openDocumentGroupPrimaryDocument(ENavTab.kClassWork, "Workspaces", "doc-9");
      expect(ui.isStartViewOverrideActiveFor(ENavTab.kClassWork)).toBe(false);
    });

    it("releases the forced tab when the user opens a secondary document", () => {
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      ui.openDocumentGroupSecondaryDocument(ENavTab.kClassWork, "Workspaces", "doc-9");
      expect(ui.isStartViewOverrideActiveFor(ENavTab.kClassWork)).toBe(false);
    });

    it("reports the override only for the tab it forces", () => {
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      expect(ui.isStartViewOverrideActiveFor(ENavTab.kClassWork)).toBe(true);
      expect(ui.isStartViewOverrideActiveFor(ENavTab.kMyWork)).toBe(false);
      ui.setActiveNavTab(ENavTab.kSortWork);
      expect(ui.isStartViewOverrideActiveFor(ENavTab.kClassWork)).toBe(false);
    });

    it("reports no open document for the forced tab, even one the user was already on", () => {
      const ui = makeSavedUI();
      // The user's saved tab IS the forced tab, with a document open: the browser has to win, and the
      // thumbnail must not read as selected, or the first click on it closes the document instead of
      // opening it.
      ui.setActiveNavTab(ENavTab.kClassWork);
      expect(ui.focusDocument).toBe("doc-1");
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      expect(ui.focusDocument).toBeUndefined();
      expect(ui.focusSecondaryDocument).toBeUndefined();
      // ...and the saved document is still there when the override ends.
      ui.setActiveNavTab(ENavTab.kClassWork);
      expect(ui.focusDocument).toBe("doc-1");
    });

    it("still reports the section path when it forces a curriculum tab", () => {
      // "No document open" does not apply to the curriculum tabs: they always show their section, so
      // comments and read-aloud must keep working there.
      const ui = makeSavedUI();
      ui.setProblemPath("unit/1/2");
      ui.setCurrentDocumentGroupId(ENavTab.kProblems, "introduction");
      ui.applyFixedStartView(ENavTab.kProblems, kDividerHalf);
      expect(ui.focusDocument).toBe("unit/1/2/introduction");
    });

    it("keeps reporting no open document after a resize", () => {
      const ui = makeSavedUI();
      ui.setActiveNavTab(ENavTab.kClassWork);
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      ui.setDividerPosition(kDividerMin);
      expect(ui.focusDocument).toBeUndefined();
    });

    it("reports the displayed tab's document group, not the user's own tab's", () => {
      // Read-aloud stops when the section on screen changes. Watching currentDocumentGroupId, which is
      // keyed off activeNavTab, would miss every change made inside the forced tab.
      const ui = makeSavedUI();
      ui.setCurrentDocumentGroupId(ENavTab.kMyWork, "Workspaces");
      ui.applyFixedStartView(ENavTab.kProblems, kDividerHalf);
      ui.setCurrentDocumentGroupId(ENavTab.kProblems, "introduction");
      expect(ui.currentDocumentGroupId).toBe("Workspaces");
      expect(ui.displayedCurrentDocumentGroupId).toBe("introduction");

      ui.setCurrentDocumentGroupId(ENavTab.kProblems, "initialChallenge");
      expect(ui.displayedCurrentDocumentGroupId).toBe("initialChallenge");
    });

    it("pins the sub tab of a forced document tab, and releases it when the user picks one", () => {
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      expect(ui.isStartViewSubTabPinnedFor(ENavTab.kClassWork)).toBe(true);
      // Another tab's pin is not this tab's business.
      expect(ui.isStartViewSubTabPinnedFor(ENavTab.kMyWork)).toBe(false);

      // A click in a tab that is not forced must not release the forced tab's pin.
      ui.selectDocumentGroup(ENavTab.kMyWork, "Workspaces");
      expect(ui.isStartViewSubTabPinnedFor(ENavTab.kClassWork)).toBe(true);

      ui.selectDocumentGroup(ENavTab.kClassWork, "Bookmarks");
      expect(ui.isStartViewSubTabPinnedFor(ENavTab.kClassWork)).toBe(false);
      expect(ui.tabs.get(ENavTab.kClassWork)?.currentDocumentGroupId).toBe("Bookmarks");
    });

    it("does not pin a sub tab on the curriculum tabs, which have no browser to start on", () => {
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kProblems, kDividerHalf);
      expect(ui.startViewSubTabPinned).toBe(false);
      // Contrast: the same call for a document tab does pin, so this is not just the field default.
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      expect(ui.startViewSubTabPinned).toBe(true);
    });

    it("releases the pinned sub tab along with the tab", () => {
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      expect(ui.startViewSubTabPinned).toBe(true);

      ui.setActiveNavTab(ENavTab.kSortWork);
      // Otherwise the author's sub tab choice would be applied to a tab the user chose.
      expect(ui.isStartViewSubTabPinnedFor(ENavTab.kClassWork)).toBe(false);
      expect(ui.startViewSubTabPinned).toBe(false);
    });

    it("does not release the pinned sub tab when code initializes a document group", () => {
      // The default-sub-tab effect uses setCurrentDocumentGroupId; only a user click releases the pin.
      const ui = makeSavedUI();
      ui.applyFixedStartView(ENavTab.kClassWork, kDividerHalf);
      ui.setCurrentDocumentGroupId(ENavTab.kClassWork, "Workspaces");
      expect(ui.isStartViewSubTabPinnedFor(ENavTab.kClassWork)).toBe(true);
    });

    it("applies to a tab the user has never visited", () => {
      const ui = makeSavedUI();
      // No tab state exists for sort-work at all, which is the common case for the feature's audience.
      ui.applyFixedStartView(ENavTab.kSortWork, kDividerHalf);
      expect(ui.isStartViewOverrideActiveFor(ENavTab.kSortWork)).toBe(true);
      expect(ui.focusDocument).toBeUndefined();
      expect(ui.tabs.get(ENavTab.kSortWork)).toBeUndefined();
    });
  });
});

describe("dividerForLayout", () => {
  it("maps each layout to a divider position", () => {
    expect(dividerForLayout("workspace-only")).toBe(kDividerMin);
    expect(dividerForLayout("resources-only")).toBe(kDividerMax);
    expect(dividerForLayout("split")).toBe(kDividerHalf);
    expect(dividerForLayout(undefined)).toBe(kDividerHalf);
  });
});

describe("resolveStartView", () => {
  const displayed = ["problems", "class-work", "sort-work"];

  it("returns undefined when the switch is off", () => {
    expect(resolveStartView({ fixedStartView: false, fixedStartTab: "class-work" }, displayed))
      .toBeUndefined();
  });

  it("returns undefined when no tab is set", () => {
    expect(resolveStartView({ fixedStartView: true }, displayed)).toBeUndefined();
  });

  it("returns undefined and warns when the tab is not displayed", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveStartView({ fixedStartView: true, fixedStartTab: "teacher-guide" }, displayed))
      .toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns undefined and warns for a tab the fixed start view cannot force", () => {
    // Student Work has no "no document open" browser view, so it is refused even when displayed.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveStartView(
      { fixedStartView: true, fixedStartTab: "student-work" },
      [...displayed, "student-work"]
    )).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns undefined and warns when the layout collapses the resources panel", () => {
    // Forcing kDividerMin would hide the tab being forced, and because only a resize releases the
    // forced divider it would close the panel on every load for a user who had opened it.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveStartView(
      { fixedStartView: true, fixedStartTab: "class-work", defaultPanelLayout: "workspace-only" },
      displayed
    )).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns undefined when the user arrived with an explicit document target", () => {
    expect(resolveStartView(
      { fixedStartView: true, fixedStartTab: "class-work", hasDocumentTarget: true },
      displayed
    )).toBeUndefined();
  });

  it("returns the tab and layout-derived divider when displayed", () => {
    expect(resolveStartView(
      { fixedStartView: true, fixedStartTab: "class-work", defaultPanelLayout: "resources-only" },
      displayed
    )).toEqual({ tab: "class-work", dividerPosition: kDividerMax });
  });
});

describe("applyStartupUIState", () => {
  const displayed = ["problems", "class-work"];

  function makeUI(dividerPosition = kDividerHalf) {
    return PersistentUIModel.create({
      version: "2.0.0",
      activeNavTab: "my-work",
      dividerPosition,
      problemWorkspace: { type: "problem", mode: "1-up" }
    });
  }

  it("applies the unit layout and then layers the forced view on top", () => {
    // Both must run. If only the override ran, releasing it would drop a first-time visitor to the
    // bare kDividerHalf default rather than the layout the author asked for.
    const ui = makeUI();
    applyStartupUIState(ui, {
      fixedStartView: true, fixedStartTab: "class-work", defaultPanelLayout: "resources-only"
    }, displayed);

    expect(ui.dividerPosition).toBe(kDividerMax);
    expect(ui.displayedNavTab).toBe("class-work");
    expect(ui.displayedDividerPosition).toBe(kDividerMax);
  });

  it("applies the unit layout but forces nothing when the switch is off", () => {
    const ui = makeUI();
    applyStartupUIState(ui, { defaultPanelLayout: "resources-only" }, displayed);

    expect(ui.dividerPosition).toBe(kDividerMax);
    expect(ui.displayedNavTab).toBe("my-work");
    expect(ui.startViewTab).toBeUndefined();
  });

  it("does not force the view when the user arrived with a document link", () => {
    // The guard this pins was briefly wired to a store member that is never assigned, which silently
    // disabled it while still type checking.
    const ui = makeUI();
    applyStartupUIState(ui, {
      fixedStartView: true, fixedStartTab: "class-work", hasDocumentTarget: true
    }, displayed);

    expect(ui.startViewTab).toBeUndefined();
    expect(ui.displayedNavTab).toBe("my-work");
  });

  it("does not force a tab that is not displayed for this user", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const ui = makeUI();
    applyStartupUIState(ui, { fixedStartView: true, fixedStartTab: "sort-work" }, displayed);

    expect(ui.startViewTab).toBeUndefined();
    warn.mockRestore();
  });

  it("leaves a returning user's divider alone while still forcing the tab", () => {
    // The saved divider must differ from the one the layout implies, or this passes whether or not
    // applyDefaultPanelLayout still honors hasSavedPersistentUI.
    const ui = makeUI(kDividerMin);
    ui.setHasSavedPersistentUI(true);
    applyStartupUIState(ui, {
      fixedStartView: true, fixedStartTab: "class-work", defaultPanelLayout: "resources-only"
    }, displayed);

    // applyDefaultPanelLayout is a no-op for a returning user, so their saved divider survives...
    expect(ui.dividerPosition).toBe(kDividerMin);
    // ...and the forced divider is only an override on top of it.
    expect(ui.displayedDividerPosition).toBe(kDividerMax);
    expect(ui.displayedNavTab).toBe("class-work");
  });
});
