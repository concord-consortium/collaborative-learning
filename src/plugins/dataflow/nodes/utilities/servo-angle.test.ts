import { kServoMaxAngle, kServoMinAngle, servoAngleForValue } from "./servo-angle";

describe("servoAngleForValue", () => {
  describe("in degrees mode", () => {
    it("passes the input through", () => {
      expect(servoAngleForValue(47, false)).toBe(47);
    });

    it("clamps at each end rather than running past", () => {
      expect(servoAngleForValue(-20, false)).toBe(kServoMinAngle);
      expect(servoAngleForValue(400, false)).toBe(kServoMaxAngle);
    });
  });

  // The unit setting a program may be authored against, so the demo output and the live one agree.
  describe("in proportion mode", () => {
    it("covers the whole sweep from 0 to 1", () => {
      expect(servoAngleForValue(0, true)).toBe(kServoMinAngle);
      expect(servoAngleForValue(0.5, true)).toBe(90);
      expect(servoAngleForValue(1, true)).toBe(kServoMaxAngle);
    });

    it("clamps beyond 0 and 1", () => {
      expect(servoAngleForValue(-0.5, true)).toBe(kServoMinAngle);
      expect(servoAngleForValue(2, true)).toBe(kServoMaxAngle);
    });
  });
});
