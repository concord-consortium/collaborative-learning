// How often the meter's timer is set. Its lateness is how long the main thread was busy.
export const kLagSampleMs = 250;

export interface IBrowserConditions {
  // How late the meter's timer fired, at worst and on average, while the tab was visible.
  lagMaxMs: number;
  lagMeanMs: number;
  // How long the tab was hidden. Chrome slows timers in a hidden tab, so a sample that the tab was
  // hidden for doesn't count toward the lag.
  hiddenMs: number;
}

interface ILagTotals {
  maxMs: number;
  totalMs: number;
  samples: number;
}

const noLag = (): ILagTotals => ({ maxMs: 0, totalMs: 0, samples: 0 });

/**
 * Measures how busy the browser is while something slow runs, such as a device connection that
 * reads from and writes to the device on the main thread. `read` gives the conditions since the
 * meter started. `readWindow` gives them since the previous `readWindow`, or since the meter
 * started, and starts a new window, so a reading late in a long run isn't diluted by its start.
 */
export function startBrowserMeter() {
  const whole = noLag();
  let recent = noLag();
  let hiddenMs = 0;
  let recentHiddenStart = 0;
  let hiddenSince = document.visibilityState === "hidden" ? Date.now() : undefined;
  let sampleSawHidden = hiddenSince !== undefined;
  let expectedAt = Date.now() + kLagSampleMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const handleVisibilityChange = () => {
    const now = Date.now();
    if (document.visibilityState === "hidden") {
      hiddenSince ??= now;
      sampleSawHidden = true;
    } else if (hiddenSince !== undefined) {
      hiddenMs += now - hiddenSince;
      hiddenSince = undefined;
    }
  };

  const sample = () => {
    const now = Date.now();
    if (!sampleSawHidden) {
      const lag = Math.max(0, now - expectedAt);
      for (const totals of [whole, recent]) {
        totals.maxMs = Math.max(totals.maxMs, lag);
        totals.totalMs += lag;
        totals.samples++;
      }
    }
    sampleSawHidden = hiddenSince !== undefined;
    expectedAt = now + kLagSampleMs;
    timer = setTimeout(sample, kLagSampleMs);
  };

  // A reading taken while the timer is overdue, such as one from a handler that ran first after the
  // main thread was busy, takes the overdue sample first, so that lag counts toward this reading.
  const takeOverdueSample = () => {
    if (stopped || Date.now() <= expectedAt) return;
    clearTimeout(timer);
    sample();
  };

  const hiddenSoFar = () => hiddenMs + (hiddenSince !== undefined ? Date.now() - hiddenSince : 0);
  const conditions = (totals: ILagTotals, hidden: number): IBrowserConditions => ({
    lagMaxMs: totals.maxMs,
    lagMeanMs: totals.samples ? Math.round(totals.totalMs / totals.samples) : 0,
    hiddenMs: hidden
  });

  document.addEventListener("visibilitychange", handleVisibilityChange);
  timer = setTimeout(sample, kLagSampleMs);

  return {
    read(): IBrowserConditions {
      takeOverdueSample();
      return conditions(whole, hiddenSoFar());
    },
    readWindow(): IBrowserConditions {
      takeOverdueSample();
      const hidden = hiddenSoFar();
      const result = conditions(recent, hidden - recentHiddenStart);
      recent = noLag();
      recentHiddenStart = hidden;
      return result;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}
