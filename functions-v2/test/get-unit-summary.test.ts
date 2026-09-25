import curriculumConfig from "../../shared/curriculum-config.json";
import {getUnitSummary} from "../src/get-unit-summary";
import {IUnitSummary} from "../../shared/unit-summary-types";

function summaryFixture(): IUnitSummary {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    sourceHash: "h",
    overview: "o",
    sourceManifest: [
      {ordinal: "1.1", title: "Problem 1.1", problemHash: "h1"},
      {ordinal: "1.2", title: "Problem 1.2", problemHash: "h2"},
    ],
    entries: [
      {ordinal: "1.1", priorKnowledge: "", problemDigest: "digest one"},
      {ordinal: "1.2", priorKnowledge: "knows things", problemDigest: "digest two"},
    ],
  };
}

function contentJsonFixture(overrides?: {config?: unknown}) {
  return {
    investigations: [
      {ordinal: 1, problems: [{ordinal: 1, title: "Problem 1.1"}, {ordinal: 2, title: "Problem 1.2"}]},
    ],
    config: overrides?.config ?? {},
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {status});
}

describe("getUnitSummary", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the summary and the walked live problem list on the happy path", async () => {
    const fetchSpy = jest.spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse(contentJsonFixture({config: {aiUnitSummary: summaryFixture()}})));

    const result = await getUnitSummary("happy-path-unit");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result?.summary).toEqual(summaryFixture());
    expect(result?.liveProblems).toEqual([
      {ordinal: "1.1", title: "Problem 1.1"},
      {ordinal: "1.2", title: "Problem 1.2"},
    ]);
  });

  it("returns liveProblems with summary undefined for a unit with no aiUnitSummary authored", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(contentJsonFixture()));

    const result = await getUnitSummary("no-summary-unit");

    expect(result?.summary).toBeUndefined();
    expect(result?.liveProblems).toEqual([
      {ordinal: "1.1", title: "Problem 1.1"},
      {ordinal: "1.2", title: "Problem 1.2"},
    ]);
  });

  // The CLUE-685 assembler walks a missing title as problem.title ?? "" when building the
  // manifest it later checks against; if the live walk here disagreed by producing the string
  // "undefined" instead, a problem with no authored title would fail the prefix check for no real
  // reason.
  it("walks a problem with no title to an empty string, not the string \"undefined\"", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({
      investigations: [{ordinal: 1, problems: [{ordinal: 1}]}],
      config: {},
    }));

    const result = await getUnitSummary("no-title-unit");

    expect(result?.liveProblems).toEqual([{ordinal: "1.1", title: ""}]);
  });

  it("returns undefined on a non-2xx response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({error: "not found"}, 404));

    const result = await getUnitSummary("missing-unit-404");

    expect(result).toBeUndefined();
  });

  it("returns undefined when the response is not valid JSON", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("not json{{{", {status: 200}));

    const result = await getUnitSummary("bad-json-unit");

    expect(result).toBeUndefined();
  });

  it("does not refetch a second call for the same unit within the cache TTL", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(contentJsonFixture()));

    const first = await getUnitSummary("ttl-unit");
    const second = await getUnitSummary("ttl-unit");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("shares one fetch across calls for the same unit that start before it resolves", async () => {
    let resolveFetch: (response: Response) => void;
    const fetchSpy = jest.spyOn(global, "fetch").mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const first = getUnitSummary("concurrent-unit");
    const second = getUnitSummary("concurrent-unit");
    resolveFetch!(jsonResponse(contentJsonFixture()));
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(secondResult).toEqual(firstResult);
  });

  it("resolves a unitCodeMap alias to its canonical code in the fetched URL", async () => {
    const [alias, canonical] = Object.entries(curriculumConfig.unitCodeMap)[0];
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(contentJsonFixture()));

    await getUnitSummary(alias);

    const [requestedUrl] = fetchSpy.mock.calls[0];
    expect(requestedUrl).toBe(`${curriculumConfig.curriculumSiteUrl}/branch/main/${canonical}/content.json`);
    expect(requestedUrl).not.toContain(alias);
  });
});
