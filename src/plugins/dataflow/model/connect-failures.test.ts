import { errorInfo, kDeviceChoiceLabels, paletteProblemText, problemHeadline, ProblemKind } from "./connect-failures";

const allProblemKinds: ProblemKind[] = [
  "openTimeout", "openFailed", "inUse", "updateFailed", "updateStalled", "notResponding", "noData",
  "lost", "noAnswer"
];

describe("connect failures", () => {
  it("palette problem texts match the spec and never name a device", () => {
    expect(paletteProblemText("openTimeout")).toBe("Stuck while opening.");
    expect(paletteProblemText("openFailed")).toBe("Couldn't open it.");
    expect(paletteProblemText("inUse")).toBe("In use by another tab.");
    expect(paletteProblemText("updateFailed")).toBe("The update failed.");
    expect(paletteProblemText("updateStalled")).toBe("Update stalled.");
    expect(paletteProblemText("notResponding")).toBe("Not responding.");
    expect(paletteProblemText("noData")).toBe("No data yet.");
    expect(paletteProblemText("lost")).toBe("Connection lost.");
    expect(paletteProblemText("noAnswer")).toBe("No answer.");
    for (const kind of allProblemKinds) {
      for (const label of Object.values(kDeviceChoiceLabels)) {
        expect(paletteProblemText(kind)).not.toContain(label);
      }
    }
  });
  it("problem headlines name the device", () => {
    expect(problemHeadline("openTimeout", "spikerbit")).toBe("The browser couldn't open the Spiker:bit.");
    expect(problemHeadline("inUse", "spikerbit")).toBe("Another tab or app is using the Spiker:bit.");
    expect(problemHeadline("noAnswer", "spikerbit")).toBe(problemHeadline("notResponding", "spikerbit"));
  });
  it("errorInfo copes with non-errors and caps the message at 300 characters", () => {
    expect(errorInfo(undefined)).toBeUndefined();
    expect(errorInfo("boom")).toEqual({ message: "boom" });
    expect(errorInfo(Object.assign(new Error("x".repeat(5000)), { code: "device-in-use" }))!.message)
      .toHaveLength(300);
  });
});
