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

  it("reads a window since the previous window, while read covers the whole run", () => {
    const meter = startBrowserMeter();
    block(400);
    jest.advanceTimersByTime(kLagSampleMs);
    expect(meter.readWindow()).toEqual({ lagMaxMs: 400, lagMeanMs: 400, hiddenMs: 0 });

    block(100);
    jest.advanceTimersByTime(kLagSampleMs);
    setVisibility("hidden");
    block(1000);
    setVisibility("visible");
    expect(meter.readWindow()).toEqual({ lagMaxMs: 100, lagMeanMs: 100, hiddenMs: 1000 });
    expect(meter.readWindow()).toEqual({ lagMaxMs: 0, lagMeanMs: 0, hiddenMs: 0 });
    expect(meter.read()).toEqual({ lagMaxMs: 400, lagMeanMs: 250, hiddenMs: 1000 });
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
