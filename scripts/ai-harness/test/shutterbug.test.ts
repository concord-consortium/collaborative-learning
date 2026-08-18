import {
  kProductionCaptureHeightPx, kProductionClueUrl, kProductionShutterbugUrl, kProductionUnit,
  shutterbugParameterized, shutterbugProductionCurrent, shutterbugRequestBody
} from "../src/backends/shutterbug.js";
import { RenderLimitExceeded } from "../src/backends/types.js";
import { makeTestPng } from "./helpers.js";

// Named to avoid shadowing the DOM `document` global in files that are about browser rendering.
const emptyDocument = { rowOrder: [], rowMap: {}, tileMap: {} };
const png = makeTestPng(1000, 1500);
const noSleep = async () => undefined;

interface Call { url: string; init?: RequestInit }

/**
 * A response body that really streams, the way `fetch` delivers one.
 *
 * `consumed` counts the chunks that were actually pulled, so a test can show the read stopped at
 * the limit rather than buffering the whole body and measuring it afterwards.
 */
function streamingBody(bytes: Buffer, pieces = 1): AsyncIterable<Uint8Array> & { consumed: number } {
  const size = Math.ceil(bytes.length / pieces);
  const body = {
    consumed: 0,
    async *[Symbol.asyncIterator]() {
      for (let at = 0; at < bytes.length; at += size) {
        body.consumed += 1;
        yield bytes.subarray(at, at + size);
      }
    }
  };
  return body;
}

/**
 * A fetch that answers the POST with `{url}` and the download with PNG bytes.
 *
 * Both replies carry a real streaming `body`, because that is what the code under test reads: the
 * POST's is bounded before it is parsed, and the download's is read chunk by chunk under a byte
 * limit. A fake offering only `json()` or `arrayBuffer()` exercised neither path.
 */
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
        body: streamingBody(Buffer.from(JSON.stringify({ url: "https://images.example.test/shot.png" }))),
        ...next
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://images.example.test/shot.png",
      headers: new Headers({ "content-type": "image/png" }),
      body: streamingBody(png, 4),
      ...options.download
    } as Response;
  };
}

/** A POST reply whose body is `text`, for the cases that are about what came back. */
const postBody = (text: string): Partial<Response> =>
  ({ body: streamingBody(Buffer.from(text)) } as unknown as Partial<Response>);

describe("production parity", () => {
  it("pins the request this mode posts", () => {
    // What this mode sends, held still so it cannot drift while the other modes evolve: production's
    // CLUE URL, unit=mods, unwrapped and read-only, height 1500 — and no fullPage.
    //
    // It pins the harness's own page, not production's. Parity with production's page is
    // *documented* (see "differences from production's HTML" in the README) rather than enforced:
    // nothing here reads functions-v2/src/on-analysis-document-pending.ts, so if production changed
    // tomorrow this test would still pass.
    const body = shutterbugRequestBody(emptyDocument, {
      clueUrl: kProductionClueUrl, unit: kProductionUnit, captureHeightPx: kProductionCaptureHeightPx
    });
    expect(Object.keys(body).sort()).toEqual(["content", "height"]);
    expect(body.height).toBe(1500);
    expect(body).not.toHaveProperty("fullPage");
    expect(body.content).toContain(
      "https://collaborative-learning.concord.org/branch/shutterbug-support/iframe.html?unit=mods");
    expect(body.content).toContain("&amp;unwrapped&amp;readOnly");
    // Targeted rather than a second copy of the whole page: render-html.test.ts already snapshots
    // the template, and two byte-identical snapshots meant every template change needed both
    // updated, with neither saying which one was the pin.
    expect(body.content).toContain(`<script>const initialValue=${JSON.stringify(emptyDocument)}</script>`);
    expect(body.content).toContain("height='500px'");
    expect(body.content).toContain("window.__clueRender = { initialValuePosted: false }");
    expect(body.content).not.toContain("fullPage");
  });

  it("posts to the production endpoint and nowhere else", async () => {
    const calls: Call[] = [];
    const backend = shutterbugProductionCurrent({ fetchImpl: fakeFetch({ calls }), sleep: noSleep });
    await backend.render({ docId: "doc", content: emptyDocument });
    expect(calls[0].url).toBe(kProductionShutterbugUrl);
    expect(JSON.parse(String(calls[0].init!.body))).toEqual(
      shutterbugRequestBody(emptyDocument, {
        clueUrl: kProductionClueUrl, unit: kProductionUnit, captureHeightPx: kProductionCaptureHeightPx
      }));
  });

  it("posts a bare string body, with no content-type — exactly as production does", () => {
    // Production and scripts/shutterbug.ts both omit the header, so fetch sends
    // text/plain;charset=UTF-8. Adding application/json would be tidier and would stop this being
    // production's request, which is the one thing this mode is for.
    const calls: Call[] = [];
    return shutterbugProductionCurrent({ fetchImpl: fakeFetch({ calls }), sleep: noSleep })
      .render({ docId: "doc", content: emptyDocument })
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
    await backend.render({ docId: "doc", content: emptyDocument });
    expect(calls[0].url).toBe("https://api.concord.org/shutterbug-staging");
    const body = JSON.parse(String(calls[0].init!.body));
    expect(body.height).toBe(4000);
    expect(body.content).toContain("http://localhost:8080/iframe.html");
    expect(backend.renderTarget.captureHeightPx).toBe(4000);
  });

  it("refuses a plaintext endpoint off loopback, which would post the document in the clear", () => {
    expect(() => shutterbugParameterized({ shutterbugUrl: "shutterbug-staging" }))
      .toThrow(/must be an https URL/);
    expect(() => shutterbugParameterized({ shutterbugUrl: "http://shutterbug.example.test" }))
      .toThrow(/must be an https URL/);
    // A local Shutterbug over http is a real development setup and stays allowed.
    expect(() => shutterbugParameterized({ shutterbugUrl: "http://localhost:4000" })).not.toThrow();
    expect(() => shutterbugParameterized({ shutterbugUrl: "http://127.0.0.1:4000" })).not.toThrow();
    expect(() => shutterbugParameterized({ shutterbugUrl: "https://api.concord.org/shutterbug-staging" }))
      .not.toThrow();
  });
});

describe("the network contract", () => {
  const backend = (options: Parameters<typeof fakeFetch>[0]) =>
    shutterbugProductionCurrent({ fetchImpl: fakeFetch(options), sleep: noSleep });

  it("returns the hosted URL alongside the downloaded bytes", async () => {
    const outcome = await backend({}).render({ docId: "doc", content: emptyDocument });
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
    }).render({ docId: "doc", content: emptyDocument });
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
    }).render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/answered 502 Bad Gateway/);
    expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(3);
  });

  it("does not retry a 4xx", async () => {
    const calls: Call[] = [];
    await expect(backend({ calls, postResponses: [{ ok: false, status: 400, statusText: "Bad Request" }] })
      .render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/answered 400 Bad Request/);
    expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(1);
  });

  it("refuses a response that is not JSON", async () => {
    await expect(backend({ postResponses: [postBody("<html>502 Bad Gateway</html>")] })
      .render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/was not JSON/);
  });

  it("refuses a JSON body with no url", async () => {
    await expect(backend({ postResponses: [postBody(JSON.stringify({ error: "nope" }))] })
      .render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/has no "url" string/);
  });

  it("refuses a non-https image URL", async () => {
    await expect(backend({ postResponses: [postBody(JSON.stringify({ url: "http://images.test/shot.png" }))] })
      .render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/non-https image URL/);
  });

  it("refuses a download whose content type is not a PNG", async () => {
    await expect(backend({ download: { headers: new Headers({ "content-type": "text/html" }) } })
      .render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/served content-type "text\/html"/);
  });

  it("refuses bytes that are not a PNG, whatever the URL ends in", async () => {
    // A `.png` suffix is not evidence of PNG bytes.
    const html = Buffer.from("<html><body>error</body></html>");
    await expect(backend({
      download: { body: streamingBody(html) } as any
    }).render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/is not a usable PNG/);
  });

  it("refuses a download the service says is too large before reading it", async () => {
    await expect(backend({
      download: { headers: new Headers({ "content-type": "image/png", "content-length": "99000000" }) }
    }).render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/declares 99000000 bytes, over the/);
  });

  it("refuses a download that turns out to be too large", async () => {
    // Split into ten pieces, so "stopped while reading" is something this can actually observe.
    const body = streamingBody(png, 10);
    const backendWithTinyLimit = shutterbugProductionCurrent({
      fetchImpl: fakeFetch({ download: { body } as unknown as Partial<Response> }),
      sleep: noSleep,
      limits: { maxHeightPx: 20_000, maxPixels: 40_000_000, maxEncodedBytes: 10 }
    });
    await expect(backendWithTinyLimit.render({ docId: "doc", content: emptyDocument }))
      .rejects.toThrow(/is over the 10 byte limit/);
    // The very first chunk already passes a 10-byte limit, so exactly one was pulled — the read
    // stopped there rather than buffering the whole body and measuring it afterwards.
    expect(body.consumed).toBe(1);
  });

  it("refuses a download that redirects somewhere less safe than where it was sent", async () => {
    // Redirects are followed, so the URL that answers need not be the one Shutterbug named. A
    // hosted image that quietly redirects to plain http, or to an address on this machine, must not
    // be downloaded and stored as a picture of a student's document.
    for (const landing of ["http://images.example.test/shot.png", "https://127.0.0.1:9/shot.png"]) {
      await expect(backend({ download: { url: landing } as Partial<Response> })
        .render({ docId: "doc", content: emptyDocument }))
        .rejects.toThrow(new RegExp(`redirected to ${landing.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`));
    }
  });

  it("refuses an image URL on a loopback or private host", async () => {
    await expect(backend({ postResponses: [postBody(JSON.stringify({ url: "https://10.0.0.5/shot.png" }))] })
      .render({ docId: "doc", content: emptyDocument }))
      .rejects.toThrow(/loopback or private host/);
  });

  it("refuses a capture whose dimensions exceed the limits, even when the bytes are small", async () => {
    // A tall, flat screenshot compresses to almost nothing, so the encoded-byte limit never fires.
    // Only the decoded dimensions catch it — and a clipped or unreasonable capture must fail rather
    // than be committed.
    const tall = makeTestPng(1000, 30_000);
    const backendWithLimits = shutterbugProductionCurrent({
      fetchImpl: fakeFetch({ download: { body: streamingBody(tall, 3) } as any }),
      sleep: noSleep
    });
    await expect(backendWithLimits.render({ docId: "endless", content: emptyDocument }))
      .rejects.toThrow(/30000px tall, over the 20000px limit/);
    // The type as well as the message: a limit failure has to be distinguishable from a transport
    // one, because only one of the two is worth another attempt.
    await expect(backendWithLimits.render({ docId: "endless", content: emptyDocument }))
      .rejects.toThrow(RenderLimitExceeded);
  });

  it("refuses an unreasonable capture height before posting anything", async () => {
    // The document is student work; an impossible --capture-height should be refused before it is
    // uploaded anywhere, not after.
    expect(() => shutterbugParameterized({ captureHeightPx: 500_000 }))
      .toThrow(/exceeds the configured limits/);
    expect(() => shutterbugParameterized({ captureHeightPx: 500_000 })).toThrow(RenderLimitExceeded);
  });

  it("refuses a failed download", async () => {
    await expect(backend({ download: { ok: false, status: 404, statusText: "Not Found" } })
      .render({ docId: "doc", content: emptyDocument })).rejects.toThrow(/answered 404 Not Found/);
  });
});
