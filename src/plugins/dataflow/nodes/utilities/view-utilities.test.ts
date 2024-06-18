import { getValueOrZero } from "./view-utilities";

describe("View Utilites", () => {
  describe("getValueOrZero" , () => {
    it("returns the value if it is valid", () => {
      expect(getValueOrZero([1.2])).toBe(1.2);
      expect(getValueOrZero([0])).toBe(0);
    });
    it("returns 0 for an undefined nodeValue", () => {
      expect(getValueOrZero(undefined)).toBe(0);
    });
    it("returns 0 for nodeValue[0] = undefined or null", () => {
      expect(getValueOrZero([undefined])).toBe(0);
      expect(getValueOrZero([null])).toBe(0);
    });
    it("returns 0 for nodeValue[0] = NaN", () => {
      expect(getValueOrZero([NaN])).toBe(0);
    });
  });
});
