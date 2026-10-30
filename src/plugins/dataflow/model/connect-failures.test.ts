import { errorInfo, kDeviceChoiceLabels, paneProblemText, problemHeadline, ProblemKind } from "./connect-failures";

const allProblemKinds: ProblemKind[] = [
  "openTimeout", "openFailed", "inUse", "updateFailed", "updateStalled", "notResponding", "noData",
  "lost", "noAnswer"
];

describe("connect failures", () => {
  it("pane problem texts match the spec and never name a device", () => {
    expect(paneProblemText("openTimeout")).toBe("Stuck while opening.");
    expect(paneProblemText("openFailed")).toBe("Couldn't open it.");
    expect(paneProblemText("inUse")).toBe("In use by another tab.");
    expect(paneProblemText("updateFailed")).toBe("The update failed.");
    expect(paneProblemText("updateStalled")).toBe("Update stalled.");
    expect(paneProblemText("notResponding")).toBe("Not responding.");
    expect(paneProblemText("noData")).toBe("No data yet.");
    expect(paneProblemText("lost")).toBe("Connection lost.");
    expect(paneProblemText("noAnswer")).toBe("No answer.");
    for (const kind of allProblemKinds) {
      for (const label of Object.values(kDeviceChoiceLabels)) {
        expect(paneProblemText(kind)).not.toContain(label);
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
