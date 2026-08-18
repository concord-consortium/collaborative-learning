import fs from "node:fs";
import path from "node:path";
import {
  buildRenderUnit, kQaUnitRepoPath, startRenderUnitServer, tileTypesARenderUnitMustList,
  tileTypesRegisteredBy
} from "../src/backends/render-unit.js";
import { tileTypes } from "../../../shared/tile-types.js";

const qaUnit = JSON.parse(fs.readFileSync(path.join(kQaUnitRepoPath, "content.json"), "utf8"));

describe("the trap: tile types register from the unit, not globally", () => {
  it("names every tile type a rendering unit has to list", () => {
    // Placeholder and Unknown are registered statically by register-tile-types.ts, and Unknown is
    // *supposed* to draw as an unknown tile.
    expect(tileTypesARenderUnitMustList()).toEqual(
      tileTypes.filter((type) => type !== "Placeholder" && type !== "Unknown"));
  });

  it("shows that the QA unit alone leaves AI and ErrorTest unregistered", () => {
    // This is the whole reason the harness owns a unit. A render under the QA unit would draw these
    // two as unknown tiles, in a perfectly valid PNG, with nothing logged.
    const registered = tileTypesRegisteredBy(qaUnit);
    const missing = tileTypesARenderUnitMustList().filter((type) => !registered.has(type));
    expect(missing.sort()).toEqual(["AI", "ErrorTest"]);
  });
});

describe("the harness's rendering unit", () => {
  const unit = buildRenderUnit({ clueUrl: "http://localhost:8080" });

  it("registers every tile type the corpus can contain", () => {
    const registered = tileTypesRegisteredBy(unit);
    for (const tileType of tileTypesARenderUnitMustList()) expect([...registered]).toContain(tileType);
  });

  it("keeps everything the QA unit already had", () => {
    for (const tileType of tileTypesRegisteredBy(qaUnit)) {
      expect([...tileTypesRegisteredBy(unit)]).toContain(tileType);
    }
    expect(unit.code).toBe(qaUnit.code);
  });

  it("makes section paths absolute, so they resolve wherever the unit is served from", () => {
    const sections = (unit.investigations as any[]).flatMap((investigation) =>
      (investigation.problems ?? []).flatMap((problem: any) => problem.sections ?? []));
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section).toMatch(/^http:\/\/localhost:8080\/demo\/units\/qa\//);
    }
  });

  it("does not modify the unit in src/public", () => {
    // Nothing the harness does writes into the application's own files.
    expect(JSON.parse(fs.readFileSync(path.join(kQaUnitRepoPath, "content.json"), "utf8"))).toEqual(qaUnit);
  });
});

describe("serving the rendering unit", () => {
  it("hands it out on loopback with a CORS header CLUE can use", async () => {
    const server = await startRenderUnitServer({ clueUrl: "http://localhost:8080" });
    try {
      expect(server.unitUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/content\.json$/);
      const response = await fetch(server.unitUrl);
      expect(response.status).toBe(200);
      // CLUE fetches the unit from its own origin, so the response has to allow that.
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(tileTypesRegisteredBy(await response.json()).has("ErrorTest")).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("answers 404 for any path but /content.json", async () => {
    // It exists so a render can name a unit by URL, not to be a file server: there is no path that
    // reaches the file system at all.
    const server = await startRenderUnitServer({ clueUrl: "http://localhost:8080" });
    const origin = server.unitUrl.replace("/content.json", "");
    try {
      // No "/../content.json" case: the URL parser collapses that to "/content.json" before the
      // request is sent, so it would be testing fetch rather than this server.
      for (const requested of ["/", "/etc/passwd", "/content.json.map", "/units/qa/content.json"]) {
        expect({ requested, status: (await fetch(`${origin}${requested}`)).status })
          .toEqual({ requested, status: 404 });
      }
      // A query string is still the unit — CLUE may append a cache-buster.
      expect((await fetch(`${server.unitUrl}?v=2`)).status).toBe(200);
    } finally {
      await server.close();
    }
  });
});
