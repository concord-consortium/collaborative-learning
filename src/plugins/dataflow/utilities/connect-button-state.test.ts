import { connectButtonState, connectButtonTooltip, toolbarShowsConnect } from "./connect-button-state";

describe("connectButtonState", () => {
  it.each([
    [true, false, false, false, "connected"],
    [true, true, true, false, "connected"],
    [true, false, false, true, "attention"],
    [true, true, false, true, "attention"],
    [false, false, false, false, "idle"],
    [false, false, false, true, "idle"],
    [false, true, false, false, "attention"],
    [false, false, true, false, "attention"],
    [false, true, true, false, "attention"]
  ])("connected=%s needsDevice=%s unseenError=%s notResponding=%s gives %s",
    (connected, needsDevice, unseenError, notResponding, expected) => {
      expect(connectButtonState({ connected, needsDevice, unseenError, notResponding })).toBe(expected);
    });
});

describe("connectButtonTooltip", () => {
  const base = { connected: false, needsDevice: false, unseenError: false, notResponding: false };

  it("names each state", () => {
    expect(connectButtonTooltip(base)).toBe("Connect a device");
    expect(connectButtonTooltip({ ...base, connected: true, connectedLabel: "Arduino" }))
      .toBe("Connected: Arduino");
    expect(connectButtonTooltip({ ...base, unseenError: true }))
      .toBe("Couldn't connect. Click for details.");
    expect(connectButtonTooltip({ ...base, needsDevice: true }))
      .toBe("This program needs a device. Click to connect.");
    expect(connectButtonTooltip({ ...base, connected: true, connectedLabel: "Spiker:bit", notResponding: true }))
      .toBe("The Spiker:bit is not responding. Click for details.");
  });

  it("the unseen-error text wins when a device is also needed", () => {
    expect(connectButtonTooltip({ ...base, needsDevice: true, unseenError: true }))
      .toBe("Couldn't connect. Click for details.");
  });

  it("leads with a loss, keeping whether the program needs a device", () => {
    const lossMessage = "The Spiker:bit was unplugged.";
    expect(connectButtonTooltip({ ...base, lossMessage }))
      .toBe("The Spiker:bit was unplugged. Click to connect.");
    expect(connectButtonTooltip({ ...base, needsDevice: true, lossMessage }))
      .toBe("The Spiker:bit was unplugged. This program needs a device. Click to connect.");
    expect(connectButtonTooltip({ ...base, unseenError: true, lossMessage }))
      .toBe("Couldn't connect. Click for details.");
  });
});

describe("toolbarShowsConnect", () => {
  it.each([
    [["zoom-in", "|", "connect", "reset"], true],
    [["zoom-in", "pan"], false],
    [[], false],
    [undefined, false],
    ["connect", false]
  ])("tools=%j gives %s", (tools, expected) => {
    expect(toolbarShowsConnect(tools)).toBe(expected);
  });
});
