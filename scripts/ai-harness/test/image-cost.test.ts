import {
  estimateImageTokens, estimateInputTokens, kCharsPerToken, kRetries, loadPricingConfig, pricingFor,
  priceTokens, worstCaseUsd
} from "../src/cost.js";
import { buildImageRequest, chatCompletionParams, requestKeyFor } from "../src/messages.js";
import { dataUrlFor } from "../src/represent-image.js";
import { canonicalJson, validateImageTokenPricing, validatePricingConfig } from "../src/schemas.js";
import { defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { makeImageRequest, makeRequest, makeTestPng, testPricing } from "./helpers.js";

const imagePricing = testPricing.imageTokens;

describe("what one image costs in input tokens", () => {
  it("charges a flat rate at low detail, whatever the size", () => {
    for (const size of [[100, 100], [4000, 6000]] as const) {
      expect(estimateImageTokens({ widthPx: size[0], heightPx: size[1], detail: "low" }, imagePricing))
        .toBe(imagePricing.detailLowFlat);
    }
  });

  it("charges base plus per-tile at high detail", () => {
    // 512×512 fits in exactly one tile and needs no scaling.
    expect(estimateImageTokens({ widthPx: 512, heightPx: 512, detail: "high" }, imagePricing))
      .toBe(imagePricing.base + imagePricing.perTile);
  });

  it("scales the short side down before counting tiles", () => {
    // 960×1420: the long side is under 2048, the short side scales 960 -> 768, giving 768×1136,
    // which covers 2 × 3 = 6 tiles.
    expect(estimateImageTokens({ widthPx: 960, heightPx: 1420, detail: "high" }, imagePricing))
      .toBe(imagePricing.base + 6 * imagePricing.perTile);
  });

  it("fits the long side first, so a very tall document does not explode", () => {
    // 1000×5000: the long side scales to 2048 (410×2048), then the short side is already under 768.
    // That is ceil(410/512)=1 by ceil(2048/512)=4 tiles.
    expect(estimateImageTokens({ widthPx: 1000, heightPx: 5000, detail: "high" }, imagePricing))
      .toBe(imagePricing.base + 4 * imagePricing.perTile);
  });

  it("never scales an image up", () => {
    // A 200×200 thumbnail stays 200×200 — one tile — rather than being blown up to 768×768.
    expect(estimateImageTokens({ widthPx: 200, heightPx: 200, detail: "high" }, imagePricing))
      .toBe(imagePricing.base + imagePricing.perTile);
  });

  it("reserves `auto` at the high rate", () => {
    // The provider publishes an exact formula only for explicit low and high, and the shared builder
    // sends `auto`, so the harness assumes the expensive branch.
    const size = { widthPx: 960, heightPx: 1420 } as const;
    expect(estimateImageTokens({ ...size, detail: "auto" }, imagePricing))
      .toBe(estimateImageTokens({ ...size, detail: "high" }, imagePricing));
    expect(estimateImageTokens({ ...size, detail: "auto" }, imagePricing))
      .toBeGreaterThan(estimateImageTokens({ ...size, detail: "low" }, imagePricing));
  });

  it.each([
    [0, 100], [100, 0], [-5, 100], [100, -5], [960.5, 1420], [960, 1420.25]
  ])("refuses to price a %p x %p image", (widthPx, heightPx) => {
    // Non-integers are refused as well as non-positives: a fractional dimension is not a pixel
    // count, and the tile arithmetic would quietly produce a fractional number of tiles.
    expect(() => estimateImageTokens({ widthPx, heightPx, detail: "auto" }, imagePricing))
      .toThrow(/both dimensions must be positive integers/);
  });
});

describe("estimating a request that contains an image", () => {
  const bytes = makeTestPng(960, 1420);
  const accounting = { sha256: "a".repeat(64), widthPx: 960, heightPx: 1420, detail: "auto" as const };
  const request = makeImageRequest(dataUrlFor(bytes), accounting);

  it("prices the image by the image formula, not by its base64 characters", () => {
    const estimate = estimateInputTokens(request, imagePricing);
    const imageTokens = estimateImageTokens(accounting, imagePricing);
    // What is left over is the prompt text and the response schema — a few hundred tokens, not the
    // tens of thousands the ÷3 heuristic would read out of half a megabyte of base64.
    expect(estimate - imageTokens).toBeGreaterThan(0);
    expect(estimate - imageTokens).toBeLessThan(1000);
  });

  it("does not grow with the length of the data URL", () => {
    // The same picture, encoded into a URL half a megabyte longer. A base64 payload that size is
    // ~170k tokens under the character heuristic — enough to blow any sane --max-cost before a
    // single call goes out — and it must make no difference at all here.
    const padded = makeImageRequest(`${dataUrlFor(bytes)}${"A".repeat(500_000)}`, accounting);
    expect(estimateInputTokens(padded, imagePricing)).toBe(estimateInputTokens(request, imagePricing));
    expect(dataUrlFor(bytes).length + 500_000).toBeGreaterThan(kCharsPerToken * 100_000);
  });

  it("lands a full-document screenshot in the tens of thousands of tokens", () => {
    const estimate = estimateInputTokens(request, imagePricing);
    expect(estimate).toBeGreaterThan(10_000);
    expect(estimate).toBeLessThan(100_000);
  });

  it("keeps a text-only request on the character heuristic", () => {
    const text = makeRequest("a".repeat(3000));
    const chars = canonicalJson(text.apiRequest.messages).length +
      canonicalJson(text.apiRequest.responseFormat).length;
    expect(estimateInputTokens(text, imagePricing)).toBeGreaterThanOrEqual(Math.ceil(chars / kCharsPerToken));
  });

  it("prices the worst case from the image estimate", () => {
    const expected = priceTokens(estimateInputTokens(request, imagePricing), 1024, testPricing) * (1 + kRetries);
    expect(worstCaseUsd(request, testPricing)).toBeCloseTo(expected, 12);
    // A whole synthetic corpus of screenshots is cents, not dollars.
    expect(worstCaseUsd(request, testPricing)).toBeLessThan(0.05);
  });

  it("stops rather than under-reserve when accounting and messages disagree", () => {
    const missing = { ...request, inputAccounting: { images: [] } };
    expect(() => estimateInputTokens(missing, imagePricing))
      .toThrow(/carries 1 image part\(s\) but 0 accounting/);
  });

  it("stops when the detail sent and the detail accounted for differ", () => {
    const mismatched = {
      ...request,
      inputAccounting: { images: [{ ...accounting, detail: "low" as const }] }
    };
    expect(() => estimateInputTokens(mismatched, imagePricing))
      .toThrow(/sent with detail "auto" but accounted for as "low"/);
  });

  it("stops when the model has no image pricing at all", () => {
    expect(() => estimateInputTokens(request)).toThrow(/no imageTokens pricing was supplied/);
  });
});

describe("accounting data never leaves the process", () => {
  const bytes = makeTestPng(20, 30);
  const request = buildImageRequest({
    model: "gpt-4o-mini",
    aiPrompt: defaultAiPrompt,
    message: "image-only",
    images: [{ imageUrl: dataUrlFor(bytes), accounting: { sha256: "b".repeat(64), widthPx: 20, heightPx: 30 } }],
    generationSettings: { max_completion_tokens: 1024 }
  });

  it("sends the model, the messages and the completion cap", () => {
    // Asserted before the absence checks below, which on their own would be satisfied by a payload
    // that carried nothing at all.
    const payload = chatCompletionParams(request);
    expect(Object.keys(payload).sort()).toEqual(["max_completion_tokens", "messages", "model"]);
    expect(payload.model).toBe("gpt-4o-mini");
    expect(payload.messages).toEqual(request.apiRequest.messages);
    expect(payload.max_completion_tokens).toBe(1024);
  });

  it("keeps inputAccounting out of the serialized API request", () => {
    const serialized = JSON.stringify(chatCompletionParams(request));
    expect(serialized).toContain("image_url");
    for (const field of ["inputAccounting", "widthPx", "heightPx", "sha256"]) {
      expect(serialized).not.toContain(field);
    }
    expect(JSON.stringify(request.apiRequest)).not.toContain("inputAccounting");
  });

  it("still folds the image hash into the cache key", () => {
    // The pixels are part of evaluation identity even when the message carries only a URL.
    const other = {
      ...request,
      inputAccounting: { images: [{ ...request.inputAccounting.images[0], sha256: "c".repeat(64) }] }
    };
    expect(requestKeyFor(request)).not.toBe(requestKeyFor(other));
  });

  it("omits an empty image list from the key", () => {
    // Empty image lists are omitted rather than hashed as `[]`, so text-only keys are byte-identical
    // to the ones written before images existed and existing cache entries keep working.
    const text = makeRequest("hello");
    expect(requestKeyFor(text)).toBe(requestKeyFor({ ...text, inputAccounting: { images: [] } }));
    // Pinned, because the two lines above are equally satisfied by a key recipe that changed for
    // *both* — and a changed recipe silently invalidates every cache entry on disk. If this fails,
    // the recipe moved: decide deliberately, then update this value.
    expect(requestKeyFor(text))
      .toBe("8c47272ed53083bacf6c40cff7e7f15c473b9fb735e8aa4674abe006a706b386");
  });
});

describe("pricing validation", () => {
  const file = "pricing.json";
  const good = { detailLowFlat: 2833, base: 2833, perTile: 5667, tileSize: 512, maxShortSide: 768, maxLongSide: 2048 };

  it("accepts the committed config and prices gpt-4o-mini's images", () => {
    const pricing = pricingFor(loadPricingConfig(), "gpt-4o-mini");
    expect(pricing.imageTokens.perTile).toBeGreaterThan(0);
    expect(pricing.imageTokens.tileSize).toBe(512);
  });

  it.each([
    ["detailLowFlat", 0],
    ["base", -1],
    ["perTile", 1.5],
    ["tileSize", "512"],
    ["maxShortSide", null],
    ["maxLongSide", undefined]
  ])("rejects a malformed %s, naming that field", (field, value) => {
    // The field name is inside the alternation on purpose: an error blaming a *different* field
    // would otherwise satisfy this, and the point of the message is to say which one is wrong.
    expect(() => validateImageTokenPricing({ ...good, [field]: value }, file, "imageTokens"))
      .toThrow(new RegExp(`imageTokens\\.${field} must be (a positive integer|a finite number)`));
  });

  it("rejects a short-side bound larger than the long-side bound", () => {
    expect(() => validateImageTokenPricing({ ...good, maxShortSide: 4096 }, file, "imageTokens"))
      .toThrow(/must not exceed maxLongSide/);
  });

  it("rejects a model with no imageTokens block at all", () => {
    const config = {
      schemaVersion: 1,
      effectiveDate: "2026-08-13",
      models: { "gpt-4o-mini": { inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6, maxOutputTokens: 1024 } }
    };
    expect(() => validatePricingConfig(config, file))
      .toThrow(/models\.gpt-4o-mini\.imageTokens must be an object/);
  });
});
