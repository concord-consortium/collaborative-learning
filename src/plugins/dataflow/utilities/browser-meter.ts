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

/**
 * Measures how busy the browser is while something slow runs, such as a device connection that
 * reads from and writes to the device on the main thread. `read` gives the conditions so far.
 */
export function startBrowserMeter() {
  let lagMaxMs = 0;
  let lagTotalMs = 0;
  let samples = 0;
  let hiddenMs = 0;
  let hiddenSince = document.visibilityState === "hidden" ? Date.now() : undefined;
  let sampleSawHidden = hiddenSince !== undefined;
  let expectedAt = Date.now() + kLagSampleMs;
  let timer: ReturnType<typeof setTimeout> | undefined;

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
      lagMaxMs = Math.max(lagMaxMs, lag);
      lagTotalMs += lag;
      samples++;
    }
    sampleSawHidden = hiddenSince !== undefined;
    expectedAt = now + kLagSampleMs;
    timer = setTimeout(sample, kLagSampleMs);
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  timer = setTimeout(sample, kLagSampleMs);

  return {
    read(): IBrowserConditions {
      return {
        lagMaxMs,
        lagMeanMs: samples ? Math.round(lagTotalMs / samples) : 0,
        hiddenMs: hiddenMs + (hiddenSince !== undefined ? Date.now() - hiddenSince : 0)
      };
    },
    stop() {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}
