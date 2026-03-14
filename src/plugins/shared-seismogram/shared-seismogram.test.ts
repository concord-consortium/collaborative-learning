import { SharedSeismogram, kSharedSeismogramType, isSharedSeismogram } from "./shared-seismogram";

// Builds a minimal valid MiniSEED 2.4 record (512 bytes, 1 sample).
function makeMiniSeedBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(512);
  const v = new DataView(buffer);

  // Fixed header
  "000001".split("").forEach((c, i) => v.setUint8(i, c.charCodeAt(0)));
  v.setUint8(6, "D".charCodeAt(0));  // data quality
  v.setUint8(7, " ".charCodeAt(0));  // reserved
  "AK   ".split("").forEach((c, i) => v.setUint8(8 + i, c.charCodeAt(0)));   // station
  v.setUint8(13, " ".charCodeAt(0)); v.setUint8(14, " ".charCodeAt(0));        // location
  "BHZ".split("").forEach((c, i) => v.setUint8(15 + i, c.charCodeAt(0)));    // channel
  "AK".split("").forEach((c, i) => v.setUint8(18 + i, c.charCodeAt(0)));     // network

  // BTIME at offset 20: 2026-01-30 00:00:00.0000
  v.setUint16(20, 2026); // year
  v.setUint16(22, 30);   // day of year

  v.setUint16(30, 1);    // number of samples
  v.setInt16(32, 100);   // sample rate factor (100 Hz)
  v.setInt16(34, 1);     // sample rate multiplier
  v.setUint8(39, 1);     // number of blockettes
  v.setUint16(44, 64);   // offset to data
  v.setUint16(46, 48);   // offset to first blockette

  // Blockette 1000 at offset 48
  v.setUint16(48, 1000); // blockette type
  v.setUint8(52, 1);     // encoding: 16-bit integer
  v.setUint8(53, 1);     // word order: big-endian
  v.setUint8(54, 9);     // record length: 2^9 = 512 bytes

  // One 16-bit sample at offset 64
  v.setInt16(64, 1000);

  return buffer;
}

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
        arrayBuffer: jest.fn().mockResolvedValue(makeMiniSeedBuffer()),
      } as any);
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
