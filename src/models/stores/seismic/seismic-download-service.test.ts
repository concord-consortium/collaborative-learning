import { SeismicDownloadService, DONE } from "./seismic-download-service";
import { DownloadEvent, DownloadParams } from "../../../../shared/seismic/seismic-downloader";

const PARAMS: DownloadParams = {
  network: "AK", station: "K204", location: "", channel: "HNZ",
  startSec: Date.UTC(2026, 0, 30) / 1000, endSec: Date.UTC(2026, 1, 1) / 1000,
};

// A runner that replays a fixed script of events on the next tick.
function scriptedRunner(script: DownloadEvent[]) {
  return (_params: DownloadParams, onEvent: (e: DownloadEvent) => void) => {
    (async () => { for (const e of script) { await Promise.resolve(); onEvent(e); } })();
  };
}

describe("SeismicDownloadService", () => {
  it("yields ready days in order, then DONE", async () => {
    const service = new SeismicDownloadService(scriptedRunner([
      { type: "progress", completed: 0, total: 2 },
      { type: "dayWritten", day: 100 },
      { type: "dayEmpty", day: 101 },
      { type: "dayWritten", day: 102 },
      { type: "done" },
    ]));

    service.ensureRange(PARAMS);
    const got: (number | typeof DONE)[] = [];
    for (;;) {
      const d = await service.nextReadyDay();
      got.push(d);
      if (d === DONE) break;
    }
    expect(got).toEqual([100, 102, DONE]);
  });

  it("records each written day's byte size, defaulting to 0 for already-cached days", async () => {
    const service = new SeismicDownloadService(scriptedRunner([
      { type: "dayWritten", day: 100, bytes: 500 },
      { type: "dayWritten", day: 101 },   // already cached — the downloader sends no size
      { type: "done" },
    ]));

    service.ensureRange(PARAMS);
    while ((await service.nextReadyDay()) !== DONE) { /* drain */ }
    expect(service.bytesForDay(100)).toBe(500);
    expect(service.bytesForDay(101)).toBe(0);
    expect(service.bytesForDay(999)).toBe(0);
  });

  it("tracks observable progress and errored days", async () => {
    const service = new SeismicDownloadService(scriptedRunner([
      { type: "progress", completed: 1, total: 2 },
      { type: "dayError", day: 100, error: "boom" },
      { type: "done" },
    ]));
    service.ensureRange(PARAMS);
    // Drain
    while ((await service.nextReadyDay()) !== DONE) { /* no-op */ }
    expect(service.completed).toBe(1);
    expect(service.total).toBe(2);
    expect(service.erroredDays).toContain(100);
  });
});
