import { ELabelOption, forEachNormalizedChange, JXGChange, JXGNormalizedChange } from "./jxg-changes";

describe("jxg-changes", () => {

  describe("forEachNormalizedChange", () => {

    function collect(change: JXGChange) {
      const results: JXGNormalizedChange[] = [];
      forEachNormalizedChange(change, (c) => results.push({ ...c }));
      return results;
    }

    it("handles a single point create", () => {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents: [1, 2],
        properties: { id: "p1" }
      };
      const results = collect(change);
      expect(results).toHaveLength(1);
      expect(results[0].operation).toBe("create");
      expect(results[0].targetID).toBe("p1");
      expect(results[0].properties?.id).toBe("p1");
    });

    it("handles batch point create with array-of-arrays parents and matching properties", () => {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents: [[1, 2], [3, 4], [5, 6]],
        properties: [
          { id: "p1", colorScheme: 0 },
          { id: "p2", colorScheme: 1 },
          { id: "p3", colorScheme: 2 }
        ]
      };
      const results = collect(change);
      expect(results).toHaveLength(3);
      expect(results[0].targetID).toBe("p1");
      expect(results[0].parents).toEqual([1, 2]);
      expect(results[0].properties?.colorScheme).toBe(0);
      expect(results[1].targetID).toBe("p2");
      expect(results[1].parents).toEqual([3, 4]);
      expect(results[2].targetID).toBe("p3");
      expect(results[2].parents).toEqual([5, 6]);
    });

    it("handles batch point create with fewer properties than parents (reuses first)", () => {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents: [[1, 2], [3, 4]],
        properties: [{ id: "shared" }]
      };
      const results = collect(change);
      expect(results).toHaveLength(2);
      // Both get the first (and only) properties entry
      expect(results[0].properties?.id).toBe("shared");
      expect(results[1].properties?.id).toBe("shared");
    });

    it("handles create with array properties (non-point target)", () => {
      // When properties is an array, isArrayCreate is true even for non-point targets
      const change: JXGChange = {
        operation: "create",
        target: "polygon",
        parents: ["p1", "p2", "p3"],
        properties: [
          { id: "poly1" },
          { id: "poly2" },
          { id: "poly3" }
        ]
      };
      const results = collect(change);
      expect(results).toHaveLength(3);
      expect(results[0].targetID).toBe("poly1");
      expect(results[1].targetID).toBe("poly2");
      expect(results[2].targetID).toBe("poly3");
    });

    it("handles single create with no properties", () => {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents: [1, 2]
      };
      const results = collect(change);
      expect(results).toHaveLength(1);
      expect(results[0].targetID).toBeUndefined();
    });

    it("handles update with single targetID", () => {
      const change: JXGChange = {
        operation: "update",
        target: "point",
        targetID: "p1",
        properties: { labelOption: ELabelOption.kLabel }
      };
      const results = collect(change);
      expect(results).toHaveLength(1);
      expect(results[0].targetID).toBe("p1");
      expect(results[0].properties?.labelOption).toBe(ELabelOption.kLabel);
    });

    it("handles update with array of targetIDs and matching properties", () => {
      const change: JXGChange = {
        operation: "update",
        target: "point",
        targetID: ["p1", "p2"],
        properties: [
          { position: [1, 10, 20] as [number, number, number] },
          { position: [1, 30, 40] as [number, number, number] }
        ]
      };
      const results = collect(change);
      expect(results).toHaveLength(2);
      expect(results[0].targetID).toBe("p1");
      expect(results[0].properties?.position).toEqual([1, 10, 20]);
      expect(results[1].targetID).toBe("p2");
      expect(results[1].properties?.position).toEqual([1, 30, 40]);
    });

    it("handles update with array of targetIDs and single properties (reuses first)", () => {
      const change: JXGChange = {
        operation: "update",
        target: "object",
        targetID: ["o1", "o2", "o3"],
        properties: [{ visible: false }]
      };
      const results = collect(change);
      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r.properties?.visible).toBe(false);
      });
    });

    it("does not call fn for delete operations", () => {
      const change: JXGChange = {
        operation: "delete",
        target: "point",
        targetID: "p1"
      };
      const results = collect(change);
      expect(results).toHaveLength(0);
    });

    it("preserves extra change fields (links, startBatch, endBatch, userAction)", () => {
      const change: JXGChange = {
        operation: "create",
        target: "point",
        parents: [1, 2],
        properties: { id: "p1" },
        startBatch: true,
        endBatch: true,
        userAction: "test"
      };
      const results = collect(change);
      expect(results).toHaveLength(1);
      const result = results[0] as any;
      expect(result.startBatch).toBe(true);
      expect(result.endBatch).toBe(true);
      expect(result.userAction).toBe("test");
    });
  });
});
