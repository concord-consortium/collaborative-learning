import { SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { SeismicEvent } from "../../../../shared/seismic/seismic-model-types";
import { DONE } from "./seismic-download-service";
// Type-only import: erased at runtime, so requireActual-ing this module inside a
// jest.mock factory never loads the processor (whose imports may be mid-mock).
import type { CoverageDownloadService } from "./seismic-coverage-processor";

/**
 * Fake SeismicDownloadService for tests.
 * Serves only the ready days that fall within the most recent ensureRange call,
 * then DONE — mirroring the real service's reset-per-ensureRange drain contract.
 * Like the real downloader (daysInRange), the day containing endSec is INCLUDED.
 * `satisfies` pins the fake to the real service's API so drift breaks compilation.
 */
export function makeFakeDownloadService(days: number[]) {
  let pending: number[] = [];
  return {
    ensureRange: jest.fn(({ startSec, endSec }: { startSec: number, endSec: number, proxy?: boolean }) => {
      pending = days.filter(d => d * SECONDS_PER_DAY >= startSec && d * SECONDS_PER_DAY <= endSec);
    }),
    nextReadyDay: jest.fn(async () => pending.shift() ?? DONE),
    readDay: jest.fn(async () => new ArrayBuffer(8)),
    cancel: jest.fn(),
    erroredDays: [] as number[],
    emptyDays: [] as number[],
  } satisfies CoverageDownloadService;
}

export type FakeDownloadService = ReturnType<typeof makeFakeDownloadService>;

/** Fake SeismicModelRunner for injection via a createRunner seam. */
export function makeFakeModelRunner() {
  return {
    loadModel: jest.fn(async (..._args: any[]): Promise<void> => undefined),
    processChunk: jest.fn(async (..._args: any[]): Promise<SeismicEvent[]> => []),
    dispose: jest.fn(),
  };
}

export type FakeModelRunner = ReturnType<typeof makeFakeModelRunner>;

/**
 * Module mock for seismic-event-service. jest.mock factories cannot close over
 * out-of-scope variables, so call this inside the factory via jest.requireActual:
 *   jest.mock("<path>/seismic-event-service", () =>
 *     jest.requireActual("<path>/seismic-coverage-test-fakes").makeEventServiceMock());
 */
export function makeEventServiceMock() {
  return {
    loadEvents: jest.fn(async () => []),
    getUncoveredRanges: jest.fn(async (_s: any, _m: any, range: any) => [range]),
    writeEvents: jest.fn(async () => {}),
    markCovered: jest.fn(async () => {}),
  };
}
