import { kLagSampleMs, startBrowserMeter } from "./browser-meter";

describe("startBrowserMeter", () => {
  let visibility: DocumentVisibilityState = "visible";

  beforeEach(() => {
    jest.useFakeTimers();
    visibility = "visible";
    jest.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function setVisibility(value: DocumentVisibilityState) {
    visibility = value;
    document.dispatchEvent(new Event("visibilitychange"));
  }

  // Moves the clock without running timers, as a main thread busy for that long does.
  function block(ms: number) {
    jest.setSystemTime(Date.now() + ms);
  }

  it("reports no lag when the timer fires on time", () => {
    const meter = startBrowserMeter();
    jest.advanceTimersByTime(kLagSampleMs * 4);
    expect(meter.read()).toEqual({ lagMaxMs: 0, lagMeanMs: 0, hiddenMs: 0 });
    meter.stop();
  });

  it("reports how late the timer fired, at worst and on average", () => {
    const meter = startBrowserMeter();
    block(400);
    jest.advanceTimersByTime(kLagSampleMs);
    jest.advanceTimersByTime(kLagSampleMs);
    expect(meter.read()).toEqual({ lagMaxMs: 400, lagMeanMs: 200, hiddenMs: 0 });
    meter.stop();
  });

  it("counts hidden time, and no lag for a sample the tab was hidden during", () => {
    const meter = startBrowserMeter();
    setVisibility("hidden");
    block(1000);
    jest.advanceTimersByTime(kLagSampleMs);
    expect(meter.read()).toEqual({ lagMaxMs: 0, lagMeanMs: 0, hiddenMs: 1000 + kLagSampleMs });
    setVisibility("visible");
    jest.advanceTimersByTime(kLagSampleMs);
    jest.advanceTimersByTime(kLagSampleMs);
    expect(meter.read()).toEqual({ lagMaxMs: 0, lagMeanMs: 0, hiddenMs: 1000 + kLagSampleMs });
    meter.stop();
  });

  it("stops sampling once stopped", () => {
    const meter = startBrowserMeter();
    meter.stop();
    block(400);
    jest.advanceTimersByTime(kLagSampleMs);
    expect(meter.read().lagMaxMs).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
