import {
  errorInfo, failureDetails, helpDetails, problemHeadline, helpTries, ProblemKind, paneProblemText, kDeviceChoiceLabels,
  sameHelp
} from "./connect-failures";

const allHelpKinds: ProblemKind[] = [
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
    for (const kind of allHelpKinds) {
      for (const label of Object.values(kDeviceChoiceLabels)) {
        expect(paneProblemText(kind)).not.toContain(label);
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
    expect(failureDetails({ kind: "openTimeout", choice: "spikerbit", step: "open", elapsedMs: 20000 }))
      .toBe("Step: open. Didn't finish within 20 s.");
    expect(failureDetails({ kind: "inUse", choice: "spikerbit", step: "open", elapsedMs: 300,
      error: { code: "device-in-use", message: "Unable to claim interface." } }))
      .toBe("Step: open. device-in-use: Unable to claim interface.");
  });

  it("helpDetails uses the failure of that kind, or says what was noticed after connecting", () => {
    const failure = { kind: "openTimeout", choice: "spikerbit", step: "open", elapsedMs: 20000 } as const;
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
});
