import {
  errorInfo, failureDetails, fakeConnectFailure, helpDetails, helpTries, kDeviceChoiceLabels, kFakeableFailures,
  kStallKinds, paletteProblemText, problemHeadline, ProblemKind, sameHelp
} from "./connect-failures";

const allHelpKinds: ProblemKind[] = [
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
    for (const kind of allHelpKinds) {
      for (const label of Object.values(kDeviceChoiceLabels)) {
        expect(paletteProblemText(kind)).not.toContain(label);
      }
    }
  });
  it("help headlines name the device", () => {
    expect(problemHeadline("openTimeout", "spikerbit")).toBe("The browser couldn't open the Spiker:bit.");
    expect(problemHeadline("inUse", "spikerbit")).toBe("Another tab or app is using the Spiker:bit.");
    expect(problemHeadline("noAnswer", "spikerbit")).toBe(problemHeadline("notResponding", "spikerbit"));
  });
  it("help tries start with one try, then 'Still not working?' tries", () => {
    const tries = helpTries("notResponding", "spikerbit");
    expect(tries.map(t => t.stillNotWorking)).toEqual([false, true, true]);
    expect(tries[0].text).toBe("Click Reconnect.");
  });
  it("the in-use try names the micro:bit for a Spiker:bit and the Arduino for an Arduino", () => {
    expect(helpTries("inUse", "spikerbit")[0].text)
      .toMatch(/^Close other tabs that are using the micro:bit, such as MakeCode\./);
    expect(helpTries("inUse", "arduino")[0].text).toContain("using the Arduino");
  });
  it("errorInfo copes with non-errors and caps the message at 300 characters", () => {
    expect(errorInfo(undefined)).toBeUndefined();
    expect(errorInfo("boom")).toEqual({ message: "boom" });
    expect(errorInfo(Object.assign(new Error("x".repeat(5000)), { code: "device-in-use" }))!.message)
      .toHaveLength(300);
  });
  it("failureDetails names the step, the error and the time", () => {
    expect(failureDetails({
      attemptId: "attempt-1", kind: "openTimeout", choice: "spikerbit", step: "open", elapsedMs: 20000
    })).toBe("Step: open. Didn't finish within 20 s.");
    expect(failureDetails({
      attemptId: "attempt-1", kind: "inUse", choice: "spikerbit", step: "open", elapsedMs: 300,
      error: { code: "device-in-use", message: "Unable to claim interface." }
    })).toBe("Step: open. device-in-use: Unable to claim interface.");
  });

  it("helpDetails uses the failure of that kind, or says what was noticed after connecting", () => {
    const failure = {
      attemptId: "attempt-1", kind: "openTimeout", choice: "spikerbit", step: "open", elapsedMs: 20000
    } as const;
    expect(helpDetails("openTimeout", failure)).toBe("Step: open. Didn't finish within 20 s.");
    expect(helpDetails("noAnswer", failure)).toBe("After connecting. No answer to the identify check.");
    expect(helpDetails("notResponding", undefined)).toBe("After connecting. No replies to its pings.");
  });

  it("sameHelp is true only for kinds with the same headline and tries", () => {
    expect(sameHelp("noAnswer", "notResponding", "spikerbit")).toBe(true);
    expect(sameHelp("openFailed", "openTimeout", "arduino")).toBe(true);
    expect(sameHelp("noData", "notResponding", "arduino")).toBe(false);
    expect(sameHelp("updateFailed", "updateStalled", "spikerbit")).toBe(false);
  });
  it("fakeConnectFailure takes a fakeable kind, defaults to openFailed, and ignores anything else", () => {
    expect(fakeConnectFailure(undefined)).toBeUndefined();
    expect(fakeConnectFailure(null)).toBe("openFailed");
    expect(fakeConnectFailure("")).toBe("openFailed");
    for (const kind of kFakeableFailures) expect(fakeConnectFailure(kind)).toBe(kind);
    expect(fakeConnectFailure("noData")).toBeUndefined();
    expect(fakeConnectFailure("bogus")).toBeUndefined();
    for (const kind of kStallKinds) expect(kFakeableFailures).not.toContain(kind);
  });
});
