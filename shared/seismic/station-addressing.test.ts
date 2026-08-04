import { getStationPrefix, parseStationPrefix, encodeLocation, decodeLocation } from "./station-addressing";

describe("station-addressing", () => {
  describe("encodeLocation / decodeLocation", () => {
    it("encodes blank locations as '--'", () => {
      expect(encodeLocation("")).toBe("--");
      expect(encodeLocation(undefined)).toBe("--");
      expect(encodeLocation("00")).toBe("00");
    });

    it("round-trips through decodeLocation", () => {
      expect(decodeLocation(encodeLocation(""))).toBe("");
      expect(decodeLocation(encodeLocation("00"))).toBe("00");
      // A literal "--" is the path encoding of blank, so it normalizes to "" rather than surviving.
      expect(decodeLocation(encodeLocation("--"))).toBe("");
    });
  });

  describe("parseStationPrefix", () => {
    it("is the inverse of getStationPrefix", () => {
      expect(parseStationPrefix("AK_K204")).toEqual({ network: "AK", station: "K204" });
      const s = { network: "AK", station: "RC01" };
      expect(parseStationPrefix(getStationPrefix(s))).toEqual(s);
    });

    it("returns undefined for improper prefixes", () => {
      expect(parseStationPrefix("prefix")).toBeUndefined();
      expect(parseStationPrefix("_prefix")).toBeUndefined();
      expect(parseStationPrefix("prefix_")).toBeUndefined();
    });
  });
});
