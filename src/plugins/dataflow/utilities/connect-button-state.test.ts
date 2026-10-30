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
      expect(connectButtonState({
        connected, needsDevice, unseenError, notResponding, stalled: false, dataReceived: true
      })).toBe(expected);
    });

  it("connected is green only once data arrives; a stall is attention", () => {
    const base = {
      connected: true, needsDevice: false, unseenError: false, notResponding: false, stalled: false,
      dataReceived: false
    };
    expect(connectButtonState(base)).toBe("idle");
    expect(connectButtonState({ ...base, dataReceived: true })).toBe("connected");
    expect(connectButtonState({ ...base, stalled: true })).toBe("attention");
  });

  it("a stall is attention even when the device isn't the active one", () => {
    expect(connectButtonState({
      connected: false, needsDevice: false, unseenError: false, notResponding: false, stalled: true,
      dataReceived: false
    })).toBe("attention");
  });
});

describe("connectButtonTooltip", () => {
  const base = {
    connected: false, needsDevice: false, unseenError: false, notResponding: false, stalled: false,
    dataReceived: true
  };

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

  it("the tooltip while connecting names the device", () => {
    expect(connectButtonTooltip({ ...base, connecting: "Spiker:bit" })).toBe("Connecting to Spiker:bit…");
  });

  it("a stall says there is no data yet", () => {
    expect(connectButtonTooltip({ ...base, connected: true, stalled: true, connectedLabel: "Arduino" }))
      .toBe("Arduino: no data yet. Click for details.");
  });

  it("an update stall says the update stalled, even when not connected", () => {
    expect(connectButtonTooltip({ ...base, stalled: true, stallKind: "updateStalled", connectedLabel: "Spiker:bit" }))
      .toBe("Spiker:bit: the update stalled. Click for details.");
  });

  it("a stall comes before an unseen error, which comes before a loss", () => {
    const all = {
      ...base, stalled: true, unseenError: true, connectedLabel: "Arduino",
      lossMessage: "The Arduino was unplugged."
    };
    expect(connectButtonState(all)).toBe("attention");
    expect(connectButtonTooltip(all)).toBe("Arduino: no data yet. Click for details.");
    expect(connectButtonTooltip({ ...all, stalled: false })).toBe("Couldn't connect. Click for details.");
    expect(connectButtonState({ ...all, stalled: false, unseenError: false })).toBe("idle");
    expect(connectButtonTooltip({ ...all, stalled: false, unseenError: false }))
      .toBe("The Arduino was unplugged. Click to connect.");
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
