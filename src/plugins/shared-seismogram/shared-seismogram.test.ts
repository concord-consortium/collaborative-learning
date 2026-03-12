import { SharedSeismogram, kSharedSeismogramType, isSharedSeismogram } from "./shared-seismogram";

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

  it("isSharedSeismogram returns true for a SharedSeismogram instance", () => {
    const model = SharedSeismogram.create();
    expect(isSharedSeismogram(model)).toBe(true);
  });

  describe("loadData", () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as any);

      jest.mock("seisplotjs", () => ({
        miniseed: {
          parseDataRecords: jest.fn().mockReturnValue([{ stub: true }]),
          merge: jest.fn().mockReturnValue({ numPoints: 42 }),
        },
      }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("sets isLoading true while fetching, then false when done", async () => {
      const model = SharedSeismogram.create();
      const promise = model.loadData();
      expect(model.isLoading).toBe(true);
      await promise;
      expect(model.isLoading).toBe(false);
    });

    it("populates seismogram after successful load", async () => {
      const model = SharedSeismogram.create();
      await model.loadData();
      expect(model.hasData).toBe(true);
      expect(model.loadError).toBeNull();
    });

    it("sets loadError on fetch failure", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
      const model = SharedSeismogram.create();
      await model.loadData();
      expect(model.loadError).toContain("Network error");
      expect(model.isLoading).toBe(false);
      expect(model.hasData).toBe(false);
    });
  });
});
