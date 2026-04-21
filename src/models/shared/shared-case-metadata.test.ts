import { applyPatch, getSnapshot, Instance, onAction, types } from "mobx-state-tree";
import { DataSet } from "../data/data-set";
import { isSharedCaseMetadata, SharedCaseMetadata } from "./shared-case-metadata";
import { SharedModel } from "./shared-model";

// eslint-disable-next-line no-var
var mockNodeIdCount = 0;
jest.mock("../../utilities/js-utils", () => ({
  typedId: () => `test-${++mockNodeIdCount}`,
  uniqueId: () => `test-${++mockNodeIdCount}`,
  uniqueOrderedId: () => `order-${++mockNodeIdCount}`
}));

describe("SharedCaseMetadata", () => {

  const TreeModel = types.model("Tree", {
    data: DataSet,
    metadata: SharedCaseMetadata
  });

  let tree: Instance<typeof TreeModel>;

  function addDefaultCases(bFn: (b: number) => number = b => b) {
    for (let a = 1; a <= 3; ++a) {
      for (let b = 1; b<= 3; ++b) {
        const _b = bFn(b);
        for (let c = 1; c <= 3; ++c) {
          tree.data.addCasesWithIDs([{ __id__: `${a}-${_b}-${c}`, aId: `${a}`, bId: `${_b}`, cId: `${c}` }]);
        }
      }
    }
  }

  beforeEach(() => {
    mockNodeIdCount = 0;

    tree = TreeModel.create({
      data: getSnapshot(DataSet.create()),
      metadata: getSnapshot(SharedCaseMetadata.create())
    });
    tree.data.addAttributeWithID({ id: "aId", name: "a" });
    tree.data.addAttributeWithID({ id: "bId", name: "b" });
    tree.data.addAttributeWithID({ id: "cId", name: "c" });
    tree.metadata.setData(tree.data);
    addDefaultCases();
  });

  it("implements isSharedCaseMetadata", () => {
    expect(isSharedCaseMetadata()).toBe(false);
    expect(isSharedCaseMetadata(SharedModel.create())).toBe(false);
    expect(isSharedCaseMetadata(tree.metadata)).toBe(true);
  });

  it("stores column widths and hidden attributes", () => {
    expect(tree.metadata.columnWidth("foo")).toBeUndefined();
    expect(tree.metadata.isHidden("foo")).toBe(false);
    tree.metadata.setColumnWidth("foo", 10);
    tree.metadata.setIsHidden("foo", true);
    expect(tree.metadata.columnWidth("foo")).toBe(10);
    expect(tree.metadata.isHidden("foo")).toBe(true);
    tree.metadata.setColumnWidth("foo");
    tree.metadata.setIsHidden("foo", false);
    expect(tree.metadata.columnWidth("foo")).toBeUndefined();
    expect(tree.metadata.isHidden("foo")).toBe(false);
    // falsy values are removed from map
    expect(tree.metadata.columnWidths.size).toBe(0);
    expect(tree.metadata.hidden.size).toBe(0);
    // can show all hidden attributes
    tree.metadata.setIsHidden("foo", true);
    expect(tree.metadata.isHidden("foo")).toBe(true);
    tree.metadata.showAllAttributes();
    expect(tree.metadata.isHidden("foo")).toBe(false);
    expect(tree.metadata.hidden.size).toBe(0);
  });

  it("responds appropriately when no DataSet is associated", () => {
    tree.metadata.setData();
    // ignores collapse calls before DataSet is associated
    expect(tree.metadata.isCollapsed("foo")).toBe(false);
    tree.metadata.setIsCollapsed("foo", true);
    expect(tree.metadata.isCollapsed("foo")).toBe(false);
    // ignores category set calls before DataSet is associated
    const categories = tree.metadata.getCategorySet("foo");
    expect(categories).toBeUndefined();
  });

  // TODO: Fix or remove if not needed.
  // it("stores collapsed pseudo-cases", () => {
  //   // ignores invalid ids
  //   expect(tree.metadata.isCollapsed("foo")).toBe(false);
  //   tree.metadata.setIsCollapsed("foo", true);
  //   expect(tree.metadata.isCollapsed("foo")).toBe(false);
  //   // move attr "a" to a new collection (["aId"], ["bId", "cId"])
  //   tree.data.moveAttributeToNewCollection("aId");
  //   const collection = tree.data.collections[0];
  //   const cases = tree.data.getCasesForAttributes(["aId"]);
  //   const case0 = cases[0];
  //   expect(tree.metadata.isCollapsed(case0.__id__)).toBe(false);
  //   tree.metadata.setIsCollapsed(case0.__id__, true);
  //   expect(tree.metadata.isCollapsed(case0.__id__)).toBe(true);
  //   tree.metadata.setIsCollapsed(case0.__id__, false);
  //   expect(tree.metadata.isCollapsed(case0.__id__)).toBe(false);
  //   expect(tree.metadata.collections.size).toBe(1);
  //   expect(tree.metadata.collections.get(collection.id)?.collapsed.size).toBe(0);
  // });

  it("getCategorySet is a pure view that does not create entries", () => {
    expect(tree.metadata.categories.size).toBe(0);
    // Reading via the view should not create anything.
    const result = tree.metadata.getCategorySet("aId");
    expect(result).toBeUndefined();
    expect(tree.metadata.categories.size).toBe(0);
  });

  describe("CategorySet lifecycle", () => {
    it("ensureProvisionalCategorySet creates a provisional and is idempotent", () => {
      expect(tree.metadata.categories.size).toBe(0);
      expect(tree.metadata.provisionalCategories.size).toBe(0);

      const cs1 = tree.metadata.ensureProvisionalCategorySet("aId");
      expect(cs1).toBeDefined();
      expect(tree.metadata.provisionalCategories.size).toBe(1);
      expect(tree.metadata.provisionalCategories.get("aId")).toBe(cs1);
      expect(tree.metadata.categories.size).toBe(0);

      const cs2 = tree.metadata.ensureProvisionalCategorySet("aId");
      expect(cs2).toBe(cs1);
      expect(tree.metadata.provisionalCategories.size).toBe(1);
    });

    it("ensureProvisionalCategorySet returns undefined for unknown attributes", () => {
      const cs = tree.metadata.ensureProvisionalCategorySet("zId");
      expect(cs).toBeUndefined();
      expect(tree.metadata.provisionalCategories.size).toBe(0);
    });

    it("ensurePersistentCategorySet creates a persistent and destroys the previous provisional", () => {
      const provisional = tree.metadata.ensureProvisionalCategorySet("aId");
      expect(provisional).toBeDefined();

      const persistent = tree.metadata.ensurePersistentCategorySet("aId");
      expect(persistent).toBeDefined();
      expect(tree.metadata.categories.size).toBe(1);
      expect(tree.metadata.categories.get("aId")).toBe(persistent);
      expect(tree.metadata.provisionalCategories.size).toBe(0);

      // The stale provisional reference is dead — any read throws.
      expect(() => (provisional as any).values).toThrow();
    });

    it("ensurePersistentCategorySet is idempotent", () => {
      const p1 = tree.metadata.ensurePersistentCategorySet("aId");
      const p2 = tree.metadata.ensurePersistentCategorySet("aId");
      expect(p1).toBe(p2);
      expect(tree.metadata.categories.size).toBe(1);
    });

    it("destroys the provisional when the underlying attribute is removed", () => {
      const provisional = tree.metadata.ensureProvisionalCategorySet("aId");
      expect(provisional).toBeDefined();
      expect(tree.metadata.provisionalCategories.size).toBe(1);

      tree.data.removeAttribute("aId");

      expect(tree.metadata.provisionalCategories.size).toBe(0);
      expect(() => (provisional as any).values).toThrow();
    });

    it("removes the persistent entry when the underlying attribute is removed", () => {
      tree.metadata.ensurePersistentCategorySet("aId");
      expect(tree.metadata.categories.size).toBe(1);
      tree.data.removeAttribute("aId");
      expect(tree.metadata.categories.size).toBe(0);
    });

    it("removeAttribute destroys a persistent entry without a separate top-level action", () => {
      tree.metadata.ensurePersistentCategorySet("aId");
      expect(tree.metadata.categories.size).toBe(1);

      const topLevelActions: string[] = [];
      const dispose = onAction(tree, (call) => {
        topLevelActions.push(call.name);
      });
      try {
        tree.data.removeAttribute("aId");
      } finally {
        dispose();
      }

      expect(topLevelActions).toEqual(["removeAttribute"]);
      expect(tree.metadata.categories.size).toBe(0);
    });

    it("removeAttribute destroys a provisional entry without a separate top-level action", () => {
      tree.metadata.ensureProvisionalCategorySet("aId");
      expect(tree.metadata.provisionalCategories.size).toBe(1);

      const topLevelActions: string[] = [];
      const dispose = onAction(tree, (call) => {
        topLevelActions.push(call.name);
      });
      try {
        tree.data.removeAttribute("aId");
      } finally {
        dispose();
      }

      expect(topLevelActions).toEqual(["removeAttribute"]);
      expect(tree.metadata.provisionalCategories.size).toBe(0);
    });

    it("removes a rehydrated persistent entry when its attribute is removed after reload", () => {
      // Create a persistent category set, then rehydrate from snapshots as
      // happens on document reopen. The per-attribute cleanup disposer must
      // be installed for rehydrated entries so attribute removal still
      // cleans them up.
      tree.metadata.ensurePersistentCategorySet("aId");
      expect(tree.metadata.categories.size).toBe(1);

      const dataSnap = getSnapshot(tree.data);
      const metaSnap = getSnapshot(tree.metadata);
      const rehydrated = TreeModel.create({ data: dataSnap, metadata: metaSnap });
      rehydrated.metadata.setData(rehydrated.data);
      expect(rehydrated.metadata.categories.size).toBe(1);

      rehydrated.data.removeAttribute("aId");
      expect(rehydrated.metadata.categories.size).toBe(0);
    });

    it("removes a patch-added persistent entry when its attribute is removed", () => {
      // A patch that inserts a persistent CategorySet directly into the map
      // (e.g. history replay / applyPatch) must still be cleaned up when
      // the underlying attribute is removed. Since the unified disposer
      // keys off the Attribute lifecycle, this works regardless of how the
      // CategorySet came into existence.
      expect(tree.metadata.categories.size).toBe(0);
      applyPatch(tree.metadata, {
        op: "add",
        path: "/categories/aId",
        value: { attribute: "aId", colors: {}, moves: [] }
      });
      expect(tree.metadata.categories.size).toBe(1);

      tree.data.removeAttribute("aId");
      expect(tree.metadata.categories.size).toBe(0);
    });
  });
});
