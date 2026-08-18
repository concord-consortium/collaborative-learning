import {
  kProductionCaptureHeightPx, kProductionClueUrl, kProductionShutterbugUrl, kProductionUnit,
  shutterbugParameterized, shutterbugProductionCurrent, shutterbugRequestBody
} from "../src/backends/shutterbug.js";
import { RenderLimitExceeded } from "../src/backends/types.js";
import { makeTestPng } from "./helpers.js";

const document = { rowOrder: [], rowMap: {}, tileMap: {} };
const png = makeTestPng(1000, 1500);
const noSleep = async () => undefined;

interface Call { url: string; init?: RequestInit }

/** A fetch that answers the POST with `{url}` and the download with PNG bytes. */
function fakeFetch(options: {
  calls?: Call[];
  postResponses?: Partial<Response>[];
  download?: Partial<Response>;
} = {}) {
  const calls = options.calls ?? [];
  const postResponses = [...(options.postResponses ?? [])];
  return async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (init?.method === "POST") {
      const next = postResponses.shift();
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ url: "https://images.example.test/shot.png" }),
        ...next
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      ...options.download
    } as Response;
  };
}

describe("production parity", () => {
  it("generates exactly today's production request", () => {
    // The snapshot that keeps this mode from drifting while the others evolve: production's CLUE
    // URL, unit=mods, unwrapped and read-only, height 1500 — and no fullPage.
    const body = shutterbugRequestBody(document, {
      clueUrl: kProductionClueUrl, unit: kProductionUnit, captureHeightPx: kProductionCaptureHeightPx
    });
    expect(Object.keys(body).sort()).toEqual(["content", "height"]);
    expect(body.height).toBe(1500);
    expect(body).not.toHaveProperty("fullPage");
    expect(body.content).toContain(
      "https://collaborative-learning.concord.org/branch/shutterbug-support/iframe.html?unit=mods");
    expect(body.content).toContain("&amp;unwrapped&amp;readOnly");
    expect(body.content).toMatchSnapshot();
  });

  it("posts to the production endpoint and nowhere else", async () => {
    const calls: Call[] = [];
    const backend = shutterbugProductionCurrent({ fetchImpl: fakeFetch({ calls }), sleep: noSleep });
    await backend.render({ docId: "doc", content: document });
    expect(calls[0].url).toBe(kProductionShutterbugUrl);
    expect(JSON.parse(String(calls[0].init!.body))).toEqual(
      shutterbugRequestBody(document, {
        clueUrl: kProductionClueUrl, unit: kProductionUnit, captureHeightPx: kProductionCaptureHeightPx
      }));
  });

  it("posts a bare string body, with no content-type — exactly as production does", () => {
    // Production and scripts/shutterbug.ts both omit the header, so fetch sends
    // text/plain;charset=UTF-8. Adding application/json would be tidier and would stop this being
    // production's request, which is the one thing this mode is for.
    const calls: Call[] = [];
    return shutterbugProductionCurrent({ fetchImpl: fakeFetch({ calls }), sleep: noSleep })
      .render({ docId: "doc", content: document })
      .then(() => {
        expect(calls[0].init?.headers).toBeUndefined();
        expect(typeof calls[0].init?.body).toBe("string");
      });
  });

  it("records a fixed-height capture, never a full-document one", () => {
    // Shutterbug clips at the height it is given. Recording that as "full-document" would be a lie
    // no freshness check could ever catch.
    const backend = shutterbugProductionCurrent({ fetchImpl: fakeFetch(), sleep: noSleep });
    expect(backend.renderTarget).toEqual({
      clueUrl: kProductionClueUrl,
      unit: kProductionUnit,
      clueRevision: null,
      shutterbugUrl: kProductionShutterbugUrl,
      viewportWidthPx: 1000,
      captureMode: "fixed-height",
      captureHeightPx: 1500
    });
  });
});

describe("the parameterized mode", () => {
  it("uses the CLUE URL, unit, endpoint and height it is given", async () => {
    const calls: Call[] = [];
    const backend = shutterbugParameterized({
      clueUrl: "http://localhost:8080",
      unit: "http://127.0.0.1:5000/content.json",
      shutterbugUrl: "https://api.concord.org/shutterbug-staging",
      captureHeightPx: 4000,
      fetchImpl: fakeFetch({ calls }),
      sleep: noSleep
    });
    await backend.render({ docId: "doc", content: document });
    expect(calls[0].url).toBe("https://api.concord.org/shutterbug-staging");
    const body = JSON.parse(String(calls[0].init!.body));
    expect(body.height).toBe(4000);
    expect(body.content).toContain("http://localhost:8080/iframe.html");
    expect(backend.renderTarget.captureHeightPx).toBe(4000);
  });

  it("refuses an endpoint that is not an http(s) URL", () => {
    expect(() => shutterbugParameterized({ shutterbugUrl: "shutterbug-staging" }))
      .toThrow(/must be an http\(s\) URL/);
  });
});

describe("the network contract", () => {
  const backend = (options: Parameters<typeof fakeFetch>[0]) =>
    shutterbugProductionCurrent({ fetchImpl: fakeFetch(options), sleep: noSleep });

  it("returns the hosted URL alongside the downloaded bytes", async () => {
    const outcome = await backend({}).render({ docId: "doc", content: document });
    expect(outcome.images).toHaveLength(1);
    expect(outcome.images[0].url).toBe("https://images.example.test/shot.png");
    expect(outcome.images[0].bytes).toEqual(png);
    expect(outcome.images[0].purpose).toBe("full-document");
    // A hosted service renders somewhere else, so it can report nothing about the render itself.
    expect(outcome.diagnostics.unknownTiles).toBeNull();
  });

  it("retries a 5xx and then succeeds", async () => {
    const calls: Call[] = [];
    const rendered = await backend({
      calls,
      postResponses: [{ ok: false, status: 503, statusText: "Service Unavailable" }]
    }).render({ docId: "doc", content: document });
    expect(rendered.images).toHaveLength(1);
    expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(2);
  });

  it("gives up after the retries are used", async () => {
    const calls: Call[] = [];
    await expect(backend({
      calls,
      postResponses: [
        { ok: false, status: 502, statusText: "Bad Gateway" },
        { ok: false, status: 502, statusText: "Bad Gateway" },
        { ok: false, status: 502, statusText: "Bad Gateway" }
      ]
    }).render({ docId: "doc", content: document })).rejects.toThrow(/answered 502 Bad Gateway/);
    expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(3);
  });

  it("does not retry a 4xx", async () => {
    const calls: Call[] = [];
    await expect(backend({ calls, postResponses: [{ ok: false, status: 400, statusText: "Bad Request" }] })
      .render({ docId: "doc", content: document })).rejects.toThrow(/answered 400 Bad Request/);
    expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(1);
  });

  it("refuses a response that is not JSON", async () => {
    await expect(backend({ postResponses: [{ json: async () => { throw new Error("Unexpected token <"); } }] })
      .render({ docId: "doc", content: document })).rejects.toThrow(/was not JSON/);
  });

  it("refuses a JSON body with no url", async () => {
    await expect(backend({ postResponses: [{ json: async () => ({ error: "nope" }) }] })
      .render({ docId: "doc", content: document })).rejects.toThrow(/has no "url" string/);
  });

  it("refuses a non-https image URL", async () => {
    await expect(backend({ postResponses: [{ json: async () => ({ url: "http://images.test/shot.png" }) }] })
      .render({ docId: "doc", content: document })).rejects.toThrow(/non-https image URL/);
  });

  it("refuses a download whose content type is not a PNG", async () => {
    await expect(backend({ download: { headers: new Headers({ "content-type": "text/html" }) } })
      .render({ docId: "doc", content: document })).rejects.toThrow(/served content-type "text\/html"/);
  });

  it("refuses bytes that are not a PNG, whatever the URL ends in", async () => {
    // A `.png` suffix is not evidence of PNG bytes.
    const html = Buffer.from("<html><body>error</body></html>");
    await expect(backend({
      download: { arrayBuffer: async () => html.buffer.slice(html.byteOffset, html.byteOffset + html.byteLength) }
    }).render({ docId: "doc", content: document })).rejects.toThrow(/is not a usable PNG/);
  });

  it("refuses a download the service says is too large before reading it", async () => {
    await expect(backend({
      download: { headers: new Headers({ "content-type": "image/png", "content-length": "99000000" }) }
    }).render({ docId: "doc", content: document })).rejects.toThrow(/declares 99000000 bytes, over the/);
  });

  it("refuses a download that turns out to be too large", async () => {
    const backendWithTinyLimit = shutterbugProductionCurrent({
      fetchImpl: fakeFetch(),
      sleep: noSleep,
      limits: { maxHeightPx: 20_000, maxPixels: 40_000_000, maxEncodedBytes: 10 }
    });
    await expect(backendWithTinyLimit.render({ docId: "doc", content: document }))
      .rejects.toThrow(RenderLimitExceeded);
  });

  it("refuses a capture whose dimensions exceed the limits, even when the bytes are small", async () => {
    // A tall, flat screenshot compresses to almost nothing, so the encoded-byte limit never fires.
    // Only the decoded dimensions catch it — and a clipped or unreasonable capture must fail rather
    // than be committed.
    const tall = makeTestPng(1000, 30_000);
    const backendWithLimits = shutterbugProductionCurrent({
      fetchImpl: fakeFetch({ download: {
        arrayBuffer: async () => new Uint8Array(tall).buffer
      } }),
      sleep: noSleep
    });
    await expect(backendWithLimits.render({ docId: "endless", content: document }))
      .rejects.toThrow(/30000px tall, over the 20000px limit/);
  });

  it("refuses an unreasonable capture height before posting anything", async () => {
    // The document is student work; an impossible --capture-height should be refused before it is
    // uploaded anywhere, not after.
    expect(() => shutterbugParameterized({ captureHeightPx: 500_000 }))
      .toThrow(/exceeds the configured limits/);
  });

  it("refuses a failed download", async () => {
    await expect(backend({ download: { ok: false, status: 404, statusText: "Not Found" } })
      .render({ docId: "doc", content: document })).rejects.toThrow(/answered 404 Not Found/);
  });
});
