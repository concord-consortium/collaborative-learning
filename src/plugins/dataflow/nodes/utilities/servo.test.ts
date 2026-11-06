import { kServoMaxAngle, kServoMinAngle, servoAngleForValue, servoDisplayMessage } from "./servo";

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

describe("servoDisplayMessage", () => {
  it("shows the rounded integer degree by default", () => {
    expect(servoDisplayMessage(90, false)).toBe("90°");
    expect(servoDisplayMessage(0, false)).toBe("0°");
    expect(servoDisplayMessage(95, false)).toBe("95°"); // rounds to the degree, not the nearest 10
  });
  it("shows % rotation in proportion mode", () => {
    expect(servoDisplayMessage(0, true)).toBe("0% rotation");
    expect(servoDisplayMessage(90, true)).toBe("50% rotation");
    expect(servoDisplayMessage(180, true)).toBe("100% rotation");
  });
});
