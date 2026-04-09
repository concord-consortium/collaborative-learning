// shared/seismic/envelope-compute.test.ts
import { computeEnvelopesFromRaw, rollUpEnvelopes } from "./envelope-compute";
import { NO_DATA_SENTINEL } from "./envelope-config";

describe("envelope-compute", () => {
  describe("computeEnvelopesFromRaw", () => {
    it("computes min/max for each grid-aligned window", () => {
      // 10 samples at 10 Hz starting at t=0, window of 0.5s → 2 windows
      const samples = new Float64Array([1, -3, 5, 2, -1, 4, 0, -2, 6, 3]);
      const result = computeEnvelopesFromRaw(samples, 10, 0.5, 0);

      expect(result.mins).toHaveLength(2);
      expect(result.maxs).toHaveLength(2);
      expect(result.times).toEqual([0, 0.5]);

      // Window [0, 0.5): [1, -3, 5, 2, -1] → min=-3, max=5
      expect(result.mins[0]).toBe(-3);
      expect(result.maxs[0]).toBe(5);

      // Window [0.5, 1.0): [4, 0, -2, 6, 3] → min=-2, max=6
      expect(result.mins[1]).toBe(-2);
      expect(result.maxs[1]).toBe(6);
    });

    it("handles a last window with fewer samples", () => {
      // 7 samples at 10 Hz starting at t=0, window of 0.5s
      // Window [0, 0.5): [1, 2, 3, 4, 5], Window [0.5, 1.0): [6, 7] (partial)
      const samples = new Float64Array([1, 2, 3, 4, 5, 6, 7]);
      const result = computeEnvelopesFromRaw(samples, 10, 0.5, 0);

      expect(result.mins).toHaveLength(2);
      expect(result.mins[1]).toBe(6);
      expect(result.maxs[1]).toBe(7);
    });

    it("aligns windows to grid when startTime is not grid-aligned", () => {
      // 10 samples at 10 Hz starting at t=0.3, window of 0.5s
      // Grid windows: [0.0, 0.5), [0.5, 1.0), [1.0, 1.5)
      // Samples at t=0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2
      // Window [0.0, 0.5): samples at 0.3, 0.4 → indices 0, 1
      // Window [0.5, 1.0): samples at 0.5..0.9 → indices 2, 3, 4, 5, 6
      // Window [1.0, 1.5): samples at 1.0..1.2 → indices 7, 8, 9
      const samples = new Float64Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      const result = computeEnvelopesFromRaw(samples, 10, 0.5, 0.3);

      expect(result.times).toEqual([0.0, 0.5, 1.0]);
      expect(result.mins[0]).toBe(10);
      expect(result.maxs[0]).toBe(20);
      expect(result.mins[1]).toBe(30);
      expect(result.maxs[1]).toBe(70);
      expect(result.mins[2]).toBe(80);
      expect(result.maxs[2]).toBe(100);
    });

    it("returns empty arrays for empty input", () => {
      const result = computeEnvelopesFromRaw(new Float64Array(0), 100, 1.0, 0);
      expect(result.mins).toHaveLength(0);
      expect(result.maxs).toHaveLength(0);
      expect(result.times).toHaveLength(0);
    });
  });

  describe("rollUpEnvelopes", () => {
    it("computes coarser envelope from finer level", () => {
      // 4 finer points rolled up with k=2 → 2 coarser points
      const finerMins = new Int16Array([-100, -200, -50, -300]);
      const finerMaxs = new Int16Array([100, 200, 50, 300]);

      const result = rollUpEnvelopes(finerMins, finerMaxs, 2);

      expect(result.mins).toHaveLength(2);
      expect(result.maxs).toHaveLength(2);

      // Coarse point 0: min of [-100, -200] = -200, max of [100, 200] = 200
      expect(result.mins[0]).toBe(-200);
      expect(result.maxs[0]).toBe(200);

      // Coarse point 1: min of [-50, -300] = -300, max of [50, 300] = 300
      expect(result.mins[1]).toBe(-300);
      expect(result.maxs[1]).toBe(300);
    });

    it("skips sentinel values during rollup", () => {
      // k=2, first pair has one sentinel → only use the non-sentinel value
      const finerMins = new Int16Array([NO_DATA_SENTINEL, -100]);
      const finerMaxs = new Int16Array([NO_DATA_SENTINEL, 100]);

      const result = rollUpEnvelopes(finerMins, finerMaxs, 2);
      expect(result.mins[0]).toBe(-100);
      expect(result.maxs[0]).toBe(100);
    });

    it("produces sentinel when all finer points are sentinel", () => {
      const finerMins = new Int16Array([NO_DATA_SENTINEL, NO_DATA_SENTINEL]);
      const finerMaxs = new Int16Array([NO_DATA_SENTINEL, NO_DATA_SENTINEL]);

      const result = rollUpEnvelopes(finerMins, finerMaxs, 2);
      expect(result.mins[0]).toBe(NO_DATA_SENTINEL);
      expect(result.maxs[0]).toBe(NO_DATA_SENTINEL);
    });
  });
});
