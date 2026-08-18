import { estimateInputTokens } from "../src/cost.js";
import { buildImageRequest, buildRequest, detailOfSingleImage, requestKeyFor } from "../src/messages.js";
import { dataUrlFor } from "../src/represent-image.js";
import { buildImageMessages, defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { makeImageRequest, makeTestPng, testPricing } from "./helpers.js";

const bytes = makeTestPng(960, 1420);
/** Facts about the file. `detail` is not one of them — the builder derives it from the message. */
const accounting = { sha256: "d".repeat(64), widthPx: 960, heightPx: 1420 };

function build(imageUrl: string, overrides: Partial<Parameters<typeof buildImageRequest>[0]> = {}) {
  return buildImageRequest({
    model: "gpt-4o-mini",
    aiPrompt: defaultAiPrompt,
    message: "image-only",
    imageUrl,
    accounting,
    generationSettings: { max_completion_tokens: 1024 },
    ...overrides
  });
}

describe("image requests are built by the shared production builder", () => {
  const hostedUrl = "https://images.example.test/shot.png";

  it("produces exactly what buildImageMessages produces, unmodified", () => {
    // The parity rule: a representation can never win by being formatted differently. This is the
    // image analogue of the text assertion in the end-to-end smoke test.
    expect(build(hostedUrl).apiRequest.messages).toEqual(buildImageMessages(defaultAiPrompt, hostedUrl));
  });

  it("leaves detail at the hardcoded auto the shared builder sends", () => {
    // Detail variants are milestone 3's, and they arrive by changing the shared builder — not by the
    // harness quietly sending something else.
    const content = build(hostedUrl).apiRequest.messages[1].content as any[];
    expect(content[1]).toEqual({ type: "image_url", image_url: { url: hostedUrl, detail: "auto" } });
  });

  it("sends the system prompt and the main prompt production sends", () => {
    const messages = build(hostedUrl).apiRequest.messages;
    expect(messages[0]).toEqual({ role: "system", content: defaultAiPrompt.systemPrompt });
    expect((messages[1].content as any[])[0]).toEqual({ type: "text", text: defaultAiPrompt.mainPrompt });
  });

  it("carries the hosted URL for a Shutterbug render", () => {
    // Exactly what production sends: the URL, not the bytes.
    expect(JSON.stringify(build(hostedUrl).apiRequest.messages)).toContain(hostedUrl);
  });

  it("carries a base64 data URL for a local capture", () => {
    // Exactly what production's categorizeDocument() does with a local file.
    const url = dataUrlFor(bytes);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(Buffer.from(url.slice("data:image/png;base64,".length), "base64")).toEqual(bytes);
    const content = build(url).apiRequest.messages[1].content as any[];
    expect(content[1].image_url.url).toBe(url);
  });

  it("records exactly one accounting entry, matching the image sent", () => {
    expect(build(hostedUrl).inputAccounting.images).toEqual([{ ...accounting, detail: "auto" }]);
  });

  it("takes the accounted detail from the message rather than assuming one", () => {
    // If the shared builder's detail ever changes, the cost model follows it instead of pricing the
    // old value — the two cannot drift apart.
    const request = build(hostedUrl);
    const sent = (request.apiRequest.messages[1].content as any[])[1].image_url.detail;
    expect(request.inputAccounting.images[0].detail).toBe(sent);
  });

  it("keeps the response schema and the completion cap", () => {
    const request = build(hostedUrl);
    expect(request.apiRequest.responseFormat.json_schema.name).toBe("categorization-response");
    expect(request.apiRequest.generationSettings.max_completion_tokens).toBe(1024);
  });
});

describe("the two builders refuse each other's message shapes", () => {
  it("buildImageRequest refuses text-only", () => {
    expect(() => build("https://x.test/a.png", { message: "text-only" }))
      .toThrow(/builds image-only messages; got message shape "text-only"/);
  });

  it("buildRequest refuses image-only", () => {
    expect(() => buildRequest({
      model: "gpt-4o-mini",
      aiPrompt: defaultAiPrompt,
      message: "image-only",
      markdown: "# summary",
      generationSettings: { max_completion_tokens: 1024 }
    })).toThrow(/builds text-only messages; got message shape "image-only"/);
  });
});

describe("what changes an image request's identity", () => {
  it("two documents with different pixels get different keys", () => {
    const other = { ...accounting, sha256: "e".repeat(64) };
    expect(requestKeyFor(build("https://x.test/a.png")))
      .not.toBe(requestKeyFor(build("https://x.test/a.png", { accounting: other })));
  });

  it("the same pixels served from two URLs get different keys", () => {
    // The URL is in the message, so it is in the key — a re-render that produced identical bytes at
    // a new URL still re-runs. Conservative in the direction that costs money rather than the one
    // that reports a stale answer.
    expect(requestKeyFor(build("https://x.test/a.png")))
      .not.toBe(requestKeyFor(build("https://x.test/b.png")));
  });

});

describe("a detail that disagrees with what is sent cannot be built", () => {
  it("refuses a caller-supplied detail rather than ignoring it", () => {
    // An accounting entry claiming `low` against a message sending `auto` would price the request at
    // the flat rate and under-reserve by an order of magnitude. The type says `detail` does not
    // belong here, but TypeScript only enforces that on a fresh object literal — a spread or a named
    // const carries it through — so it is refused at runtime too.
    expect(() => build("https://x.test/a.png", { accounting: { ...accounting, detail: "low" } as never }))
      .toThrow(/derives `detail` from the message it builds/);
  });

  it("still catches a mismatch in a request assembled some other way", () => {
    // Defence in depth: milestone 3's mixed-mode builder, or a hand-assembled request, does not go
    // through buildImageRequest, and the reservation must not be estimated from the wrong rate.
    const mismatched = makeImageRequest("https://x.test/a.png",
      { ...accounting, detail: "low" }, 1024);
    (mismatched.apiRequest.messages[1].content as any[])[1].image_url.detail = "auto";
    expect(() => estimateInputTokens(mismatched, testPricing.imageTokens))
      .toThrow(/sent with detail "auto" but accounted for as "low"/);
  });

  it("refuses a message list the shared builder would never produce", () => {
    // Two image parts, or none, means the builder's contract changed underneath us. Guessing at the
    // right number to reserve for is the one thing that must not happen.
    expect(() => detailOfSingleImage([])).toThrow(/exactly one image part, got 0/);
    expect(() => detailOfSingleImage([{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: "https://x.test/a.png" } },
        { type: "image_url", image_url: { url: "https://x.test/b.png" } }
      ]
    }] as never)).toThrow(/exactly one image part, got 2/);
  });

  it("treats an absent detail as the provider's own default", () => {
    // `auto` is both the provider's default and the conservative branch of the cost model.
    expect(detailOfSingleImage([{
      role: "user", content: [{ type: "image_url", image_url: { url: "https://x.test/a.png" } }]
    }] as never)).toBe("auto");
  });

  it("refuses a detail it does not recognise", () => {
    expect(() => detailOfSingleImage([{
      role: "user", content: [{ type: "image_url", image_url: { url: "https://x.test/a.png", detail: "ultra" } }]
    }] as never)).toThrow(/unrecognised detail "ultra"/);
  });
});
