/**
 * The three named render modes, and how `--mode` turns into a backend.
 *
 * They are named and separate on purpose. The three sources that already render CLUE documents
 * disagree about what a screenshot is — production clips at 1500px with `unit=mods`,
 * `scripts/shutterbug.ts` clips at 500px and adds `fullPage`, and `scripts/ai/document-screenshots.ts`
 * uses the standalone editor at a different URL entirely. Folding an improvement into the parity
 * baseline would quietly destroy the only thing it is for.
 */
import { git } from "../files.js";
import { RenderBackend } from "./types.js";
import { kPuppeteerBackendVersion, puppeteerBackend } from "./puppeteer.js";
import {
  kProductionClueUrl, kProductionShutterbugUrl, kShutterbugBackendVersion, shutterbugParameterized,
  shutterbugProductionCurrent
} from "./shutterbug.js";
import { kHarnessRenderUnitId } from "./render-unit.js";

/**
 * Everything that is fixed about a mode, stated once.
 *
 * `backendId`, `backendVersion`, the prerequisites line and which unit the mode needs were
 * previously spread across a ternary, a switch, and three string comparisons against
 * `"puppeteer-full-height"` in the CLI. Adding milestone 3's per-tile mode meant finding all of
 * them, and missing the unit one is silent: CLUE falls back to its default unit and every tile
 * draws as an unknown tile in a perfectly valid PNG.
 */
export interface RenderModeDescriptor {
  backendId: string;
  backendVersion: number;
  /** One line for `plan` and the README: what has to be true before this mode can run. */
  prerequisites: string;
  /**
   * The unit identifier this mode renders with, or null when the mode fixes its own. A mode with a
   * unit here also needs that unit served — see `needsUnitServer`.
   */
  defaultUnit: string | null;
  /** Whether `render` must serve the harness's own rendering unit for this mode. */
  needsUnitServer: boolean;
  /** Options this mode cannot honour, by the CLI flag a caller would have used. */
  unusableFlags: (keyof RenderModeOptions)[];
  build(options: RenderModeOptions): RenderBackend;
}

export const renderModeIds = [
  "puppeteer-full-height",
  "shutterbug-production-current",
  "shutterbug-parameterized"
] as const;
export type RenderModeId = typeof renderModeIds[number];

export const kDefaultRenderModeId: RenderModeId = "puppeteer-full-height";
export const kDefaultClueUrl = "http://localhost:8080";

/** The CLI flag a caller would have typed for each option, for error messages. */
const kFlagNames: Partial<Record<keyof RenderModeOptions, string>> = {
  clueUrl: "--clue-url",
  unit: "--unit",
  shutterbugUrl: "--shutterbug-url",
  captureHeightPx: "--capture-height"
};

export interface RenderModeOptions {
  clueUrl?: string;
  unit?: string;
  /** Where the unit is actually fetched from, when that differs from its stable identifier. */
  unitUrl?: string;
  shutterbugUrl?: string;
  captureHeightPx?: number;
  /** What CLUE build is being rendered. `null` is recorded, and `render` warns about it. */
  clueRevision?: string | null;
  launch?: Parameters<typeof puppeteerBackend>[0]["launch"];
  /** Readiness timing, lowered by tests so a fake browser does not sit through real intervals. */
  stableForMs?: number;
  pollIntervalMs?: number;
}

export const renderModes: Record<RenderModeId, RenderModeDescriptor> = {
  "puppeteer-full-height": {
    backendId: "puppeteer",
    backendVersion: kPuppeteerBackendVersion,
    prerequisites: `a CLUE dev server at ${kDefaultClueUrl} (npm start); no OpenAI key`,
    defaultUnit: kHarnessRenderUnitId,
    needsUnitServer: true,
    // This mode always captures the whole document, so accepting a capture height and dropping it
    // would silently answer a different question from the one that was asked.
    unusableFlags: ["shutterbugUrl", "captureHeightPx"],
    build: (options) => puppeteerBackend({
      clueUrl: options.clueUrl ?? kDefaultClueUrl,
      unit: requireUnit(options.unit, "puppeteer-full-height"),
      unitUrl: options.unitUrl,
      clueRevision: options.clueRevision === undefined ? localClueRevision() : options.clueRevision,
      launch: options.launch,
      stableForMs: options.stableForMs,
      pollIntervalMs: options.pollIntervalMs
    })
  },
  "shutterbug-production-current": {
    backendId: "shutterbug",
    backendVersion: kShutterbugBackendVersion,
    prerequisites: `network access to ${kProductionShutterbugUrl} and ${kProductionClueUrl}; no OpenAI key`,
    defaultUnit: null,
    needsUnitServer: false,
    // Frozen by definition: this mode exists to reproduce today's production request exactly.
    unusableFlags: ["clueUrl", "unit", "shutterbugUrl", "captureHeightPx"],
    build: (options) => shutterbugProductionCurrent({ clueRevision: options.clueRevision ?? null })
  },
  "shutterbug-parameterized": {
    backendId: "shutterbug",
    backendVersion: kShutterbugBackendVersion,
    prerequisites: "network access to the configured Shutterbug endpoint and CLUE URL; no OpenAI key",
    defaultUnit: null,
    needsUnitServer: false,
    unusableFlags: [],
    build: (options) => shutterbugParameterized({
      clueUrl: options.clueUrl,
      unit: options.unit,
      shutterbugUrl: options.shutterbugUrl,
      captureHeightPx: options.captureHeightPx,
      clueRevision: options.clueRevision ?? null
    })
  }
};

export function isRenderModeId(value: string): value is RenderModeId {
  return (renderModeIds as readonly string[]).includes(value);
}

/** The one place an unknown `--mode` is rejected. */
export function renderMode(modeId: string): RenderModeDescriptor {
  if (!isRenderModeId(modeId)) {
    throw new Error(`Unknown render mode "${modeId}". Known modes: ${renderModeIds.join(", ")}`);
  }
  return renderModes[modeId];
}

/**
 * Which renderer a mode uses, and at what version — without building the backend.
 *
 * `run` and `plan` need this to check a stored render is still usable, and building the real backend
 * would mean starting a unit server and, for the local mode, launching a browser. Neither belongs in
 * a command that is supposed to touch nothing.
 */
export function renderBackendIdentity(modeId: string): { backendId: string; backendVersion: number } {
  const { backendId, backendVersion } = renderMode(modeId);
  return { backendId, backendVersion };
}

/**
 * The CLUE revision a local render ran against: `http://localhost:8080` serves different code
 * tomorrow, so the commit is part of the render target rather than a footnote. `null` when git cannot
 * answer — the caller warns, and `--refresh` is always available.
 */
export function localClueRevision(): string | null {
  const commit = git(["rev-parse", "--short", "HEAD"]);
  if (!commit) return null;
  const status = git(["status", "--porcelain"]);
  return status && status.length > 0 ? `${commit} (dirty)` : commit;
}

/**
 * Refuses options a mode cannot honour, without building anything.
 *
 * Separate from `getRenderBackend` so `render` can validate before it starts a unit server: building
 * the backend first meant an invalid flag left the server listening and hung the CLI.
 */
export function assertRenderModeOptions(modeId: string, options: RenderModeOptions = {}): void {
  const given = renderMode(modeId).unusableFlags
    .filter((option) => options[option] !== undefined)
    .map((option) => kFlagNames[option] ?? String(option));
  if (given.length > 0) {
    throw new Error(`${given.join(", ")} ${given.length === 1 ? "is" : "are"} not configurable for ` +
      `--mode ${modeId}. Use --mode shutterbug-parameterized to change the render target.`);
  }
}

/**
 * Builds the backend for a mode. Flags that a mode does not use are refused rather than ignored: a
 * `--clue-url` silently dropped by the parity baseline would look like it had been applied.
 */
export function getRenderBackend(modeId: string, options: RenderModeOptions = {}): RenderBackend {
  const mode = renderMode(modeId);
  assertRenderModeOptions(modeId, options);
  return mode.build({ ...options, unit: options.unit ?? mode.defaultUnit ?? undefined });
}

function requireUnit(unit: string | undefined, modeId: string): string {
  if (!unit) {
    throw new Error(`--mode ${modeId} needs a unit. Tile types register from the unit's own ` +
      "configuration, so a render with no unit loads CLUE's default unit and draws most tiles as " +
      "unknown tiles — in a perfectly valid PNG. The render command supplies the harness's own " +
      "rendering unit when --unit is not given.");
  }
  return unit;
}
