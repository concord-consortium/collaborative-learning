import { estimateInputTokens } from "../src/cost.js";
import {
  buildImageRequest, buildMixedRequest, buildRequest, detailsOfImages, requestKeyFor
} from "../src/messages.js";
import { dataUrlFor } from "../src/represent-image.js";
import {
  buildImageMessages, buildMixedMessages, defaultAiPrompt
} from "../../../shared/ai-analysis-messages.js";
import { makeImageRequest, makeTestPng, testPricing } from "./helpers.js";

const bytes = makeTestPng(960, 1420);
/** Facts about the file. `detail` is not one of them — the builder derives it from the message. */
const accounting = { sha256: "d".repeat(64), widthPx: 960, heightPx: 1420 };

function build(imageUrl: string, overrides: Partial<Parameters<typeof buildImageRequest>[0]> = {}) {
  return buildImageRequest({
    model: "gpt-4o-mini",
    aiPrompt: defaultAiPrompt,
    message: "image-only",
    images: [{ imageUrl, accounting }],
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
    // Comparing detail settings means changing the shared builder — not the
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
      .not.toBe(requestKeyFor(build("https://x.test/a.png",
        { images: [{ imageUrl: "https://x.test/a.png", accounting: other }] })));
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
    expect(() => build("https://x.test/a.png", {
      images: [{ imageUrl: "https://x.test/a.png", accounting: { ...accounting, detail: "low" } as never }]
    })).toThrow(/Image accounting describes the file, not the request/);
  });

  it("still catches a mismatch in a request assembled some other way", () => {
    // Defence in depth: a future mixed-mode builder, or a hand-assembled request, does not go
    // through buildImageRequest, and the reservation must not be estimated from the wrong rate.
    const mismatched = makeImageRequest("https://x.test/a.png",
      { ...accounting, detail: "low" }, 1024);
    (mismatched.apiRequest.messages[1].content as any[])[1].image_url.detail = "auto";
    expect(() => estimateInputTokens(mismatched, testPricing.imageTokens))
      .toThrow(/sent with detail "auto" but accounted for as "low"/);
  });

  it("reads back a detail per image part, in the order they are sent", () => {
    expect(detailsOfImages([])).toEqual([]);
    expect(detailsOfImages([{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: "https://x.test/a.png", detail: "high" } },
        { type: "image_url", image_url: { url: "https://x.test/b.png", detail: "low" } }
      ]
    }] as never)).toEqual(["high", "low"]);
  });

  it("pairs each image's file facts with the detail sent at the same position", () => {
    // The pairing is positional, so a two-image request must not attribute the first file's pixels
    // to the second part. This is what the cost model reserves from.
    const first = { ...accounting, sha256: "1".repeat(64) };
    const second = { ...accounting, sha256: "2".repeat(64), widthPx: 480, heightPx: 700 };
    const request = build("unused", {
      images: [
        { imageUrl: "https://x.test/a.png", accounting: first },
        { imageUrl: "https://x.test/b.png", accounting: second }
      ],
      detail: "high"
    });
    expect(request.inputAccounting.images).toEqual([
      { ...first, detail: "high" },
      { ...second, detail: "high" }
    ]);
    const content = request.apiRequest.messages[1].content as any[];
    expect(content.slice(1).map((part: any) => part.image_url.url))
      .toEqual(["https://x.test/a.png", "https://x.test/b.png"]);
  });

  it("refuses an image request with no image at all", () => {
    expect(() => build("unused", { images: [] })).toThrow(/needs at least one image/);
  });

  it("treats an absent detail as the provider's own default", () => {
    // `auto` is both the provider's default and the conservative branch of the cost model.
    expect(detailsOfImages([{
      role: "user", content: [{ type: "image_url", image_url: { url: "https://x.test/a.png" } }]
    }] as never)).toEqual(["auto"]);
  });

  it("refuses a detail it does not recognise", () => {
    expect(() => detailsOfImages([{
      role: "user", content: [{ type: "image_url", image_url: { url: "https://x.test/a.png", detail: "ultra" } }]
    }] as never)).toThrow(/unrecognised detail "ultra"/);
  });
});

describe("mixed requests are built by the shared production builder", () => {
  const related = [{
    summary: "A related document's summary.",
    agreements: { yes: [{ content: "Agreed.", tags: [] }] } as never
  }];

  const buildMixed = (overrides: Partial<Parameters<typeof buildMixedRequest>[0]> = {}) =>
    buildMixedRequest({
      model: "gpt-4o-mini",
      aiPrompt: defaultAiPrompt,
      message: "mixed",
      markdown: "The student drew a box.",
      relatedSummaries: related,
      images: [{ imageUrl: "https://x.test/doc.png", accounting }],
      generationSettings: { max_completion_tokens: 1024 },
      ...overrides
    });

  it("produces exactly what buildMixedMessages produces, unmodified", () => {
    // The parity rule, for the third shape: a representation can never win by being formatted
    // differently from the one it is being compared against.
    expect(buildMixed().apiRequest.messages).toEqual(buildMixedMessages(
      defaultAiPrompt, "The student drew a box.", related, [{ url: "https://x.test/doc.png" }], {}));
  });

  it("is the text-only message with the picture appended", () => {
    // Read against `buildRequest` rather than a literal, so the two shapes cannot drift apart
    // without this failing.
    const textOnly = buildRequest({
      model: "gpt-4o-mini",
      aiPrompt: defaultAiPrompt,
      message: "text-only",
      markdown: "The student drew a box.",
      relatedSummaries: related,
      generationSettings: { max_completion_tokens: 1024 }
    });
    const textParts = textOnly.apiRequest.messages[1].content as any[];
    const mixedParts = buildMixed().apiRequest.messages[1].content as any[];
    expect(mixedParts.slice(0, textParts.length)).toEqual(textParts);
    expect(mixedParts.slice(textParts.length))
      .toEqual([{ type: "image_url", image_url: { url: "https://x.test/doc.png", detail: "auto" } }]);
  });

  it("sends only the pictures when the document has no student text", () => {
    const content = buildMixed({ markdown: null }).apiRequest.messages[1].content as any[];
    expect(content.map((part: any) => part.type)).toEqual(["text", "image_url"]);
    expect(content[0].text).toBe(defaultAiPrompt.mainPrompt);
  });

  it("accounts for every picture it sends", () => {
    const second = { ...accounting, sha256: "9".repeat(64) };
    const request = buildMixed({
      images: [
        { imageUrl: "https://x.test/a.png", accounting },
        { imageUrl: "https://x.test/b.png", accounting: second }
      ],
      detail: "low"
    });
    expect(request.inputAccounting.images)
      .toEqual([{ ...accounting, detail: "low" }, { ...second, detail: "low" }]);
  });

  it("refuses the wrong message shape, and a mixed request with no picture", () => {
    expect(() => buildMixed({ message: "text-only" }))
      .toThrow(/builds mixed messages; got message shape "text-only"/);
    expect(() => buildMixed({ images: [] })).toThrow(/needs at least one image/);
  });
});

describe("a run configured the way it was before these dimensions existed keeps its key", () => {
  // The request key is the cache key and the resume key. New experiment dimensions change the built
  // messages, so they change the key on their own — but a run that asks for none of them has to
  // produce the key it always did, or every cache entry and every resumable row silently
  // invalidates.
  //
  // These two values were read off the pre-milestone-3 code (`CLUE-371` at b0ef0a19) by building the
  // same requests there, so they pin the key against what actually shipped rather than against
  // whatever this branch happens to produce.
  it("a text-only request's key does not move", () => {
    const request = buildRequest({
      model: "gpt-4o-mini",
      aiPrompt: defaultAiPrompt,
      message: "text-only",
      markdown: "The student drew a box.",
      generationSettings: { max_completion_tokens: 1024 }
    });
    expect(requestKeyFor(request))
      .toBe("997fbcf6dd3b2481da739b499d5094109a5e66fbf69700d96415e7067585f7af");
  });

  it("an image-only request's key does not move", () => {
    expect(requestKeyFor(build("https://images.example.test/shot.png")))
      .toBe("cf5465f23060eb90c645bd14edb5695404905ffb7c29681562f87a65cafbeb88");
  });
});
