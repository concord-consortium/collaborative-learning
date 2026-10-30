import { ConnectionAttempt } from "../model/connection-attempt";
import { IConnectFailure } from "../model/connect-failures";
import { connectPaneStatus, IPaneStatusInput } from "./connect-pane-status";

const base: IPaneStatusInput = {
  attempt: undefined, isConnected: false, dataReceived: false, label: "Spiker:bit", failure: undefined,
  loss: undefined, notResponding: false, check: undefined, updateResumed: false
};

const connectedBase = { ...base, isConnected: true };

function running(step: "choose" | "open" | "checkFirmware" | "update" | "waitForData") {
  const attempt = new ConnectionAttempt("spikerbit", "connect");
  attempt.setStep(step);
  return attempt;
}

const failure = (kind: IConnectFailure["kind"]): IConnectFailure =>
  ({ kind, choice: "spikerbit", step: "open", elapsedMs: 1000 });

describe("connectPaneStatus", () => {
  it("idle", () => {
    expect(connectPaneStatus(base)).toEqual({
      line1: "Not connected",
      line2: { text: "Plug in a device, then click Connect.", tone: "hint" }, announce: false
    });
  });

  it("chooser open", () => {
    expect(connectPaneStatus({ ...base, attempt: running("choose") })).toEqual({
      line1: "Connecting to Spiker:bit…",
      line2: { text: "Choose it in the browser's list.", tone: "hint" }, announce: false
    });
  });

  it("names the chosen device before the connection has a label", () => {
    expect(connectPaneStatus({ ...base, label: undefined, attempt: running("open") }).line1)
      .toBe("Connecting to Spiker:bit…");
  });

  it.each(["choose", "open", "checkFirmware", "waitForData"] as const)(
    "names the device being connected, not the one used before, while %s runs", step => {
      const { line1 } = connectPaneStatus({ ...base, label: "Arduino", attempt: running(step) });
      expect(line1).toContain("Spiker:bit");
      expect(line1).not.toContain("Arduino");
    });

  it("opening", () => {
    expect(connectPaneStatus({ ...base, attempt: running("open") })).toEqual({
      line1: "Connecting to Spiker:bit…",
      line2: { text: "Opening the connection…", tone: "plain" }, announce: false
    });
  });

  it("checking firmware", () => {
    expect(connectPaneStatus({ ...connectedBase, attempt: running("checkFirmware") })).toEqual({
      line1: "Connected: Spiker:bit",
      line2: { text: "Checking its firmware…", tone: "plain" }, announce: false
    });
  });

  it("updating shows the warning on line 1 and the bar with its percent on line 2", () => {
    const attempt = running("update");
    attempt.updateProgress(45);
    expect(connectPaneStatus({ ...connectedBase, attempt })).toEqual({
      line1: "Updating. Keep it plugged in.",
      line2: { text: "45%", tone: "plain", progress: 45 }, announce: false
    });
  });

  it("a stalled update that is making progress again shows the bar, not the stall", () => {
    const attempt = running("update");
    attempt.end("updateStalled", failure("updateStalled"));
    attempt.updateProgress(60);
    expect(connectPaneStatus({ ...base, attempt, updateResumed: true })).toEqual({
      line1: "Updating. Keep it plugged in.",
      line2: { text: "60%", tone: "plain", progress: 60 }, announce: false
    });
  });

  it("waiting for data", () => {
    expect(connectPaneStatus({ ...connectedBase, attempt: running("waitForData") })).toEqual({
      line1: "Connected: Spiker:bit",
      line2: { text: "Waiting for data…", tone: "plain" }, announce: false
    });
  });

  it("receiving data", () => {
    expect(connectPaneStatus({ ...connectedBase, dataReceived: true })).toEqual({
      line1: "Connected: Spiker:bit",
      line2: { text: "Receiving data.", tone: "hint" }, announce: false
    });
  });

  it("a failure before or at the open shows the problem on the device list", () => {
    expect(connectPaneStatus({ ...base, failure: failure("openTimeout") })).toEqual({
      line1: "Not connected",
      line2: { text: "Stuck while opening.", tone: "problem" }, announce: true
    });
  });

  it("a stall keeps the connected line", () => {
    expect(connectPaneStatus({ ...connectedBase, failure: failure("noData") })).toEqual({
      line1: "Connected: Spiker:bit",
      line2: { text: "No data yet.", tone: "problem" }, announce: true
    });
  });

  it("unplugged after connecting", () => {
    expect(connectPaneStatus({ ...base, loss: "unplugged" })).toEqual({
      line1: "Not connected", line2: { text: "It was unplugged.", tone: "problem" }, announce: true
    });
  });

  it("lost after connecting", () => {
    expect(connectPaneStatus({ ...base, loss: "lost" })).toEqual({
      line1: "Not connected",
      line2: { text: "Connection lost.", tone: "problem" }, announce: true
    });
  });

  it("not responding later", () => {
    expect(connectPaneStatus({ ...connectedBase, dataReceived: true, notResponding: true })).toEqual({
      line1: "Connected: Spiker:bit",
      line2: { text: "Not responding.", tone: "problem" }, announce: true
    });
  });

  it("is it alive: checking, answered and no answer", () => {
    expect(connectPaneStatus({ ...connectedBase, check: "checking" })).toEqual({
      line1: "Connected: Spiker:bit",
      line2: { text: "Look for the heart…", tone: "plain" }, announce: false
    });
    expect(connectPaneStatus({ ...connectedBase, check: "answered" })).toEqual({
      line1: "Connected: Spiker:bit", line2: { text: "It answered.", tone: "plain" }, announce: false
    });
    expect(connectPaneStatus({ ...connectedBase, check: "noAnswer" })).toEqual({
      line1: "Connected: Spiker:bit",
      line2: { text: "No answer.", tone: "problem" }, announce: true
    });
  });

  it("announces exactly the problem lines", () => {
    const inputs: IPaneStatusInput[] = [
      base, { ...base, attempt: running("choose") }, { ...connectedBase, check: "answered" },
      { ...base, loss: "unplugged" }, { ...base, failure: failure("openFailed") }
    ];
    expect(inputs.map(i => connectPaneStatus(i).announce)).toEqual([false, false, false, true, true]);
  });
});
