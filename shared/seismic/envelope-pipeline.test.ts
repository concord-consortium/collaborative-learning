// shared/seismic/envelope-pipeline.test.ts
import { createPipelineState } from "./envelope-pipeline";
import { NUM_LEVELS } from "./envelope-config";

describe("envelope-pipeline", () => {
  describe("createPipelineState", () => {
    it("initializes empty state with correct structure", () => {
      const state = createPipelineState();
      expect(state.openTiles).toHaveLength(NUM_LEVELS);
      for (let i = 0; i < NUM_LEVELS; i++) {
        expect(state.openTiles[i].size).toBe(0);
      }
      expect(state.l1Accumulators.size).toBe(0);
      expect(state.l0Accumulators.size).toBe(0);
      expect(state.highestL2GlobalIndex).toBe(-1);
    });
  });
});
