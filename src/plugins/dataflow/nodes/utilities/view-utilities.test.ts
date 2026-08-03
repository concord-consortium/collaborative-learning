import { getNodeLetter, getValueOrZero } from "./view-utilities";

describe("View Utilites", () => {
  // Badge letters follow the user-facing displayName, which diverges from the internal type name for
  // the renamed blocks (Sensor, Waves, Compare, Hold). Timer is hidden but retained for existing docs.
  describe("getNodeLetter", () => {
    it("uses the first letter of the internal type by default", () => {
      expect(getNodeLetter("Sensor")).toBe("S");
      expect(getNodeLetter("Number")).toBe("N");
      expect(getNodeLetter("Math")).toBe("M");
    });
    it("maps renamed blocks to their displayName letter", () => {
      expect(getNodeLetter("Generator")).toBe("W"); // Waves
      expect(getNodeLetter("Logic")).toBe("C");     // Compare
      expect(getNodeLetter("Control")).toBe("H");   // Hold
    });
    it("keeps the Timer letter for existing programs", () => {
      expect(getNodeLetter("Timer")).toBe("t");
    });
  });

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
