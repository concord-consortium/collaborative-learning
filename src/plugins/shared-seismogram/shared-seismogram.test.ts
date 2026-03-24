import { SharedSeismogram, kSharedSeismogramType, isSharedSeismogram } from "./shared-seismogram";

// Mock the earthscope client
jest.mock("../../../shared/seismic/earthscope-client", () => ({
  fetchRawSeismicData: jest.fn(),
}));

// Mock seisplotjs miniSEED parsing
jest.mock("seisplotjs", () => ({
  miniseed: {
    parseDataRecords: jest.fn(() => [{ sample: 1 }]),
    merge: jest.fn(() => ({ startTime: new Date(), endTime: new Date() })),
  },
  seismogram: {},
}));

import { fetchRawSeismicData } from "../../../shared/seismic/earthscope-client";

const mockFetch = fetchRawSeismicData as jest.MockedFunction<typeof fetchRawSeismicData>;

describe("SharedSeismogram", () => {
  it("has the correct type", () => {
    const model = SharedSeismogram.create();
    expect(model.type).toBe(kSharedSeismogramType);
  });

  it("starts with no seismogram data, not loading, no error", () => {
    const model = SharedSeismogram.create();
    expect(model.seismogram).toBeUndefined();
    expect(model.hasData).toBe(false);
    expect(model.isLoading).toBe(false);
    expect(model.loadError).toBeNull();
  });

  it("stores seismogram data after setSeismogram", () => {
    const model = SharedSeismogram.create();
    const fakeSeismogram = { numPoints: 100 } as any;
    model.setSeismogram(fakeSeismogram);
    expect(model.seismogram).toBe(fakeSeismogram);
    expect(model.hasData).toBe(true);
  });

  it("can clear seismogram data", () => {
    const model = SharedSeismogram.create();
    model.setSeismogram({ numPoints: 100 } as any);
    model.setSeismogram(undefined);
    expect(model.seismogram).toBeUndefined();
    expect(model.hasData).toBe(false);
  });

  it("exposes startTime and endTime from the seismogram", () => {
    const model = SharedSeismogram.create();
    // Before data is loaded, should be undefined
    expect(model.startTime).toBeUndefined();
    expect(model.endTime).toBeUndefined();

    // After setting a seismogram, should reflect its times
    const mockSeismogram = { startTime: 1000, endTime: 2000 } as any;
    model.setSeismogram(mockSeismogram);
    expect(model.startTime).toBe(mockSeismogram.startTime);
    expect(model.endTime).toBe(mockSeismogram.endTime);
  });

  it("isSharedSeismogram returns true for a SharedSeismogram instance", () => {
    const model = SharedSeismogram.create();
    expect(isSharedSeismogram(model)).toBe(true);
  });

  describe("loadData", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockFetch.mockResolvedValue(new Response(new ArrayBuffer(8)));
    });

    it("sets isLoading true while fetching, then false when done", async () => {
      const model = SharedSeismogram.create();
      const promise = model.loadData("2026-01-30", "2026-01-31");
      expect(model.isLoading).toBe(true);
      await promise;
      expect(model.isLoading).toBe(false);
    });

    it("populates seismogram after successful load", async () => {
      const model = SharedSeismogram.create();
      await model.loadData("2026-01-30", "2026-01-31");
      expect(model.hasData).toBe(true);
      expect(model.loadError).toBeNull();
    });

    it("surfaces unexpected fetch errors in loadError", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      const model = SharedSeismogram.create();
      await model.loadData("2026-01-30", "2026-01-31");
      expect(model.loadError).toContain("Network error");
      expect(model.isLoading).toBe(false);
      expect(model.hasData).toBe(false);
    });

    it("calls fetchRawSeismicData once per day in the date range", async () => {
      const model = SharedSeismogram.create();
      await model.loadData("2026-01-30", "2026-02-01"); // 2 days

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "AK", "K204", "HNZ",
        expect.stringContaining("2026-01-30"),
        expect.stringContaining("2026-01-31")
      );
    });

    it("skips days where fetch throws (no data available)", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("No mock data"))
        .mockResolvedValueOnce(new Response(new ArrayBuffer(8)));

      const model = SharedSeismogram.create();
      await model.loadData("2026-01-29", "2026-01-31"); // day 1 fails, day 2 succeeds

      expect(model.loadError).toBeNull();
    });

    it("sets loadError when all days fail with no-data errors", async () => {
      mockFetch.mockRejectedValue(new Error("No mock data"));

      const model = SharedSeismogram.create();
      await model.loadData("2020-01-01", "2020-01-03");

      expect(model.loadError).toContain("No seismic data");
    });

    it("sets loadError for invalid date range (end before start)", async () => {
      const model = SharedSeismogram.create();
      await model.loadData("2026-02-06", "2026-01-30");

      expect(model.loadError).toContain("Invalid date range");
      expect(model.isLoading).toBe(false);
    });

    it("sets loadError for same start and end date", async () => {
      const model = SharedSeismogram.create();
      await model.loadData("2026-01-30", "2026-01-30");

      expect(model.loadError).toContain("Invalid date range");
      expect(model.isLoading).toBe(false);
    });
  });
});
