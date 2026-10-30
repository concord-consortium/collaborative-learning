import { ConnectionAttempt } from "./connection-attempt";

describe("ConnectionAttempt", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
  });
  afterEach(() => jest.useRealTimers());

  it("a connect starts choosing on the device list, and records each step's time from the click", () => {
    const attempt = new ConnectionAttempt("arduino", "connect", "a1");
    expect(attempt).toMatchObject({
      id: "a1", choice: "arduino", trigger: "connect", startedAt: 1000, step: "choose", view: "devices",
      actionsEnabled: false, ended: false, recovered: false
    });
    jest.advanceTimersByTime(300);
    attempt.chooserClosed();
    expect(attempt.step).toBe("open");
    jest.advanceTimersByTime(200);
    attempt.opened("waitForData");
    expect(attempt.view).toBe("actions");
    attempt.activated();
    expect(attempt.steps).toEqual({ chooserClosed: 300, opened: 500, active: 500 });
    expect(attempt.elapsedMs).toBe(500);
  });

  it("a reconnect starts on the actions, opening", () => {
    const attempt = new ConnectionAttempt("spikerbit", "reconnect");
    expect(attempt.id).toEqual(expect.any(String));
    expect(attempt.step).toBe("open");
    expect(attempt.view).toBe("actions");
  });

  it("records the firmware found and whether it was updated", () => {
    const attempt = new ConnectionAttempt("spikerbit", "connect");
    attempt.opened("checkFirmware");
    attempt.firmwareChecked("legacy v3", true);
    expect(attempt.step).toBe("update");
    expect(attempt.steps.updateStarted).toBe(0);
    attempt.updateProgress(45);
    expect(attempt.updatePercent).toBe(45);
    attempt.updateFinished();
    expect(attempt.firmware).toEqual({ found: "legacy v3", updated: true });
  });

  it("a stall enables the actions and keeps the view", () => {
    const attempt = new ConnectionAttempt("arduino", "connect");
    attempt.opened("waitForData");
    attempt.end("noData", {
      attemptId: attempt.id, kind: "noData", choice: "arduino", step: "waitForData", elapsedMs: 5000
    });
    expect(attempt).toMatchObject({ ended: true, outcome: "noData", actionsEnabled: true, view: "actions" });
    expect(attempt.failure?.kind).toBe("noData");
    attempt.dataArrived();
    expect(attempt.recovered).toBe(true);
  });

  it("a failure, a cancel or a loss goes back to the device list", () => {
    const reconnect = new ConnectionAttempt("arduino", "reconnect");
    reconnect.end("openTimeout", {
      attemptId: reconnect.id, kind: "openTimeout", choice: "arduino", step: "open", elapsedMs: 20000
    });
    expect(reconnect).toMatchObject({ view: "devices", actionsEnabled: false });
    const canceled = new ConnectionAttempt("arduino", "reconnect");
    canceled.end("canceled");
    expect(canceled.view).toBe("devices");
    const unplugged = new ConnectionAttempt("arduino", "connect");
    unplugged.opened("waitForData");
    unplugged.end("unplugged");
    expect(unplugged.view).toBe("devices");
  });

  it("first data on a running attempt isn't a recovery", () => {
    const attempt = new ConnectionAttempt("arduino", "connect");
    attempt.opened("waitForData");
    attempt.dataArrived();
    attempt.end("connected");
    expect(attempt.recovered).toBe(false);
    expect(attempt.actionsEnabled).toBe(true);
  });
});
