import { getSnapshot } from "@concord-consortium/mobx-state-tree";
import {
  PersistentUIModel, PersistentUIModelV1Snapshot, PersistenUIModelV2Snapshot, UIDocumentGroup, UITabModel
} from "./persistent-ui";

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
        tab.setPrimaryDocumentInDocumentGroup("testGroup", "1234");

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

        tab.setPrimaryDocumentInDocumentGroup("testGroup", "1234");

        expect([...tab.visitedDocumentGroups.keys()]).toEqual(["testGroup"]);
        expect(visitedGroup.primaryDocumentKey).toBe("1234");
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

  describe("migration from V1", () => {
    it("can load a basic V1 snapshot", () => {
      const snapshot: PersistentUIModelV1Snapshot = {
        version: "1.0.0",
        tabs: {},
        problemWorkspace: {
          type: "problem",
          mode: "1-up"
        }
      };
      const ui = PersistentUIModel.create(snapshot as unknown as PersistenUIModelV2Snapshot);
      expect(ui.version).toBe("2.0.0");
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
      const ui = PersistentUIModel.create(snapshot as unknown as PersistenUIModelV2Snapshot);
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
      const ui = PersistentUIModel.create(snapshot as unknown as PersistenUIModelV2Snapshot);
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
      expect(tabModel.getPrimaryDocumentInDocumentGroup("testSubTab2")).toBe("doc2");
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
      const ui = PersistentUIModel.create(snapshot as unknown as PersistenUIModelV2Snapshot);
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
      expect(tabModel.getPrimaryDocumentInDocumentGroup("testSubTab2")).toBe("doc2");
      expect([...tabModel.visitedDocumentGroups.keys()]).toEqual(["testSubTab1", "testSubTab2", "testSubTab3"]);
    });
  });
});
