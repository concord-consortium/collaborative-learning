// shared/seismic/envelope-codec.test.ts
import { encodeEnvelopeTile, decodeEnvelopeTile, quantize, dequantize } from "./envelope-codec";
import { NO_DATA_SENTINEL, NUM_LEVELS, POINTS_PER_TILE } from "./envelope-config";

describe("envelope-codec", () => {
  describe("quantize / dequantize", () => {
    it("maps zero to zero", () => {
      expect(quantize(0, 0.05)).toBe(0);
      expect(dequantize(0, 0.05)).toBe(0);
    });

    it("maps rangeMax to 32767", () => {
      expect(quantize(0.05, 0.05)).toBe(32767);
    });

    it("maps -rangeMax to -32767", () => {
      expect(quantize(-0.05, 0.05)).toBe(-32767);
    });

    it("round-trips with acceptable precision", () => {
      const rangeMax = 0.05;
      const original = 0.001; // typical teleseismic signal
      const quantized = quantize(original, rangeMax);
      const restored = dequantize(quantized, rangeMax);
      // Precision: each step = 0.05/32767 ≈ 1.5µm/s
      expect(Math.abs(restored - original)).toBeLessThan(0.000002);
    });

    it("clamps values outside the range", () => {
      expect(quantize(0.1, 0.05)).toBe(32767);
      expect(quantize(-0.1, 0.05)).toBe(-32767);
    });

    it("does not produce the sentinel value for valid inputs", () => {
      // -32768 is reserved for "no data"
      expect(quantize(-0.05, 0.05)).toBe(-32767);
    });
  });

  describe("encodeEnvelopeTile / decodeEnvelopeTile", () => {
    it("round-trips tiles at all levels", () => {
      for (let level = 0; level < NUM_LEVELS; level++) {
        const size = POINTS_PER_TILE[level];
        const mins = new Int16Array(size);
        const maxs = new Int16Array(size);
        for (let i = 0; i < size; i++) {
          mins[i] = -(i % 32767);
          maxs[i] = i % 32767;
        }

        const encoded = encodeEnvelopeTile(mins, maxs);
        expect(encoded).toBeInstanceOf(ArrayBuffer);

        const decoded = decodeEnvelopeTile(encoded);
        expect(decoded.mins).toEqual(mins);
        expect(decoded.maxs).toEqual(maxs);
      }
    });

    it("round-trips a tile with sentinel values", () => {
      const size = POINTS_PER_TILE[0];
      const mins = new Int16Array(size).fill(NO_DATA_SENTINEL);
      const maxs = new Int16Array(size).fill(NO_DATA_SENTINEL);

      const decoded = decodeEnvelopeTile(encodeEnvelopeTile(mins, maxs));
      expect(decoded.mins[0]).toBe(NO_DATA_SENTINEL);
      expect(decoded.maxs[0]).toBe(NO_DATA_SENTINEL);
    });

    it("rejects mismatched array lengths", () => {
      const mins = new Int16Array(100);
      const maxs = new Int16Array(200);
      expect(() => encodeEnvelopeTile(mins, maxs)).toThrow();
    });
  });
});
