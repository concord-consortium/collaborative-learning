/**
 * The unit a render loads, and the tiny server that hands it to CLUE.
 *
 * Tile types are not registered globally. `stores.ts` builds the tile-type list from the loaded
 * unit's `toolbar`, `authorTools` and `tools` and registers exactly those. A render that passes no
 * unit loads CLUE's `defaultUnit` — `sas`, a CMP maths unit — and every tile type outside that unit's
 * toolbar becomes an `Unknown` content model drawn by the placeholder component. Nothing is logged.
 * The renderer writes a perfectly valid PNG of the wrong thing.
 *
 * The QA unit covers 18 of the 20 registered tile types the synthetic corpus uses; `AI` and
 * `ErrorTest` are missing. Rather than author a whole unit from scratch, the harness serves the QA
 * unit with those two added — everything else about it is then a unit that is already known to work.
 * Its section paths are relative to wherever the unit is served from, so they are rewritten to
 * absolute URLs against the CLUE server before it is handed over.
 *
 * Nothing here writes into `src/public/`.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { AddressInfo } from "node:net";
import { harnessRoot } from "../corpus.js";
import { tileTypes } from "../../../../shared/tile-types.js";

/**
 * The stable name the harness's own rendering unit is recorded under.
 *
 * It is deliberately not the URL it is served from: that carries an ephemeral loopback port which
 * changes on every run, and recording *that* in the render target would make every stored render look
 * stale the moment the server restarted.
 */
export const kHarnessRenderUnitId = "harness-render";

/** Where the QA unit lives in the repository, and where CLUE serves it from. */
export const kQaUnitRepoPath = path.join(harnessRoot, "..", "..", "src", "public", "demo", "units", "qa");
export const kQaUnitServedPath = "demo/units/qa";

/**
 * Registered statically by `register-tile-types.ts` rather than through a unit's toolbar, so no unit
 * has to list them — and `Unknown` is *supposed* to draw as an unknown tile.
 */
const kStaticallyRegistered = new Set(["Placeholder", "Unknown"]);

interface ToolbarEntry { id: string; title?: string; isTileTool?: boolean }

/** Every tile type a unit must list for the whole synthetic corpus to render as itself. */
export function tileTypesARenderUnitMustList(): string[] {
  return tileTypes.filter((type) => !kStaticallyRegistered.has(type));
}

/** The tile types a unit's configuration will actually register. Mirrors `stores.ts`. */
export function tileTypesRegisteredBy(unit: unknown): Set<string> {
  const config = (unit as { config?: Record<string, unknown> })?.config ?? {};
  const fromList = (value: unknown): string[] => Array.isArray(value)
    ? value.map((entry) => typeof entry === "string" ? entry : (entry as ToolbarEntry)?.id).filter(Boolean) as string[]
    : [];
  return new Set([
    ...fromList(config.toolbar),
    ...fromList(config.authorTools),
    ...fromList(config.tools)
  ]);
}

export interface BuildRenderUnitOptions {
  /** The CLUE server the unit's section files will be fetched from, e.g. `http://localhost:8080`. */
  clueUrl: string;
  /** Overridden in tests. Defaults to the QA unit in this repository. */
  baseUnit?: unknown;
}

/**
 * Builds the harness's rendering unit: the QA unit, plus any registered tile type it does not list,
 * with section paths made absolute so they resolve wherever the unit itself is served from.
 */
export function buildRenderUnit(options: BuildRenderUnitOptions): Record<string, unknown> {
  const base = options.baseUnit ?? JSON.parse(fs.readFileSync(path.join(kQaUnitRepoPath, "content.json"), "utf8"));
  const unit = JSON.parse(JSON.stringify(base)) as Record<string, any>;
  const sectionBase = `${options.clueUrl.replace(/\/+$/, "")}/${kQaUnitServedPath}/`;

  unit.config ??= {};
  const toolbar: ToolbarEntry[] = Array.isArray(unit.config.toolbar) ? unit.config.toolbar : [];
  const registered = tileTypesRegisteredBy(unit);
  for (const tileType of tileTypesARenderUnitMustList()) {
    if (registered.has(tileType)) continue;
    toolbar.push({ id: tileType, title: tileType, isTileTool: true });
  }
  unit.config.toolbar = toolbar;

  for (const investigation of unit.investigations ?? []) {
    for (const problem of investigation.problems ?? []) {
      if (!Array.isArray(problem.sections)) continue;
      problem.sections = problem.sections.map((section: unknown) =>
        typeof section === "string" && !/^https?:\/\//.test(section) ? `${sectionBase}${section}` : section);
    }
  }
  return unit;
}

export interface RenderUnitServer {
  /** The absolute URL to pass as CLUE's `unit` parameter. */
  unitUrl: string;
  close(): Promise<void>;
}

/**
 * Serves the rendering unit at `/content.json` on a loopback port.
 *
 * CLUE fetches the unit from its own origin, so the response carries a permissive CORS header. The
 * server binds to 127.0.0.1 and serves exactly one path: it exists so a render can name a unit by
 * URL, not to be a file server.
 */
export async function startRenderUnitServer(options: BuildRenderUnitOptions): Promise<RenderUnitServer> {
  const body = `${JSON.stringify(buildRenderUnit(options))}\n`;
  const server = http.createServer((request, response) => {
    if ((request.url ?? "").split("?")[0] !== "/content.json") {
      // CLUE probes for an optional teacher-guide/content.json beside the unit and handles a real
      // 404 gracefully — but without the CORS header a 404 reaches a cross-origin caller as a
      // network-level failure, which CLUE throws on. The header matters here as much as on the 200.
      response.writeHead(404, { "content-type": "text/plain", "access-control-allow-origin": "*" });
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    });
    response.end(body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    unitUrl: `http://127.0.0.1:${port}/content.json`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
