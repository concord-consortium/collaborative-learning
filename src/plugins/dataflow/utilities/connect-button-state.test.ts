import { connectButtonState, connectButtonTooltip } from "./connect-button-state";

describe("connectButtonState", () => {
  it.each([
    [true, false, false, "connected"],
    [true, true, true, "connected"],
    [false, false, false, "idle"],
    [false, true, false, "attention"],
    [false, false, true, "attention"],
    [false, true, true, "attention"]
  ])("connected=%s needsDevice=%s unseenError=%s gives %s", (connected, needsDevice, unseenError, expected) => {
    expect(connectButtonState({ connected, needsDevice, unseenError })).toBe(expected);
  });

  it("a failure while the program needs no device pulses", () => {
    expect(connectButtonState({ connected: false, needsDevice: false, unseenError: true })).toBe("attention");
  });
});

describe("connectButtonTooltip", () => {
  it("names each state", () => {
    expect(connectButtonTooltip({ connected: false, needsDevice: false, unseenError: false }))
      .toBe("Connect a device");
    expect(connectButtonTooltip({ connected: true, connectedLabel: "Arduino", needsDevice: false, unseenError: false }))
      .toBe("Connected: Arduino");
    expect(connectButtonTooltip({ connected: false, needsDevice: false, unseenError: true }))
      .toBe("Couldn't connect. Click for details.");
    expect(connectButtonTooltip({ connected: false, needsDevice: true, unseenError: false }))
      .toBe("This program needs a device. Click to connect.");
  });

  it("the unseen-error text wins when a device is also needed", () => {
    expect(connectButtonTooltip({ connected: false, needsDevice: true, unseenError: true }))
      .toBe("Couldn't connect. Click for details.");
  });
});
