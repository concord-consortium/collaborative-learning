// shared/seismic/envelope-config.test.ts
import {
  LEVEL_SPACINGS, K_FACTOR, POINTS_PER_TILE, AMPLITUDE_RANGES,
  NO_DATA_SENTINEL, NUM_LEVELS
} from "./envelope-config";

describe("envelope-config", () => {
  it("has 3 levels", () => {
    expect(LEVEL_SPACINGS).toHaveLength(3);
    expect(POINTS_PER_TILE).toHaveLength(3);
    expect(NUM_LEVELS).toBe(3);
  });

  it("K_FACTOR matches the ratio between adjacent levels", () => {
    for (let i = 0; i < LEVEL_SPACINGS.length - 1; i++) {
      const ratio = LEVEL_SPACINGS[i] / LEVEL_SPACINGS[i + 1];
      expect(ratio).toBe(K_FACTOR);
    }
  });

  it("POINTS_PER_TILE is per-level with L2 having more points", () => {
    expect(POINTS_PER_TILE[0]).toBe(1024);
    expect(POINTS_PER_TILE[1]).toBe(1024);
    expect(POINTS_PER_TILE[2]).toBe(20480);
  });

  it("has amplitude ranges for H, L, and N instrument codes", () => {
    expect(AMPLITUDE_RANGES.H).toBe(0.05);
    expect(AMPLITUDE_RANGES.L).toBe(0.05);
    expect(AMPLITUDE_RANGES.N).toBe(40);
  });

  it("NO_DATA_SENTINEL is Int16 min", () => {
    expect(NO_DATA_SENTINEL).toBe(-32768);
  });
});
