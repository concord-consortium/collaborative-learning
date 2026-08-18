/**
 * Pricing, worst-case estimation, and the reservation ledger that makes `--max-cost` a real bound.
 *
 * `plan` and `run` call the same `worstCaseUsd` so a plan's projected maximum is never lower than
 * what a run can reserve.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HarnessRequest, InputImageAccounting } from "./messages.js";
import {
  ImageTokenPricing, ModelPricing, PricingConfig, canonicalJson, validatePricingConfig
} from "./schemas.js";

const kPricingFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "pricing.json");

/** Conservative characters-per-token divisor used for pre-flight estimates. */
export const kCharsPerToken = 3;

/** Each request may be attempted this many extra times after the first. */
export const kRetries = 2;

export function loadPricingConfig(file: string = kPricingFile): PricingConfig {
  const text = fs.readFileSync(file, "utf8");
  return validatePricingConfig(JSON.parse(text), file);
}

export function pricingFor(config: PricingConfig, model: string, file: string = kPricingFile): ModelPricing {
  const pricing = config.models[model];
  if (!pricing) {
    throw new Error(`${file}: no pricing for model "${model}" ` +
      `(known models: ${Object.keys(config.models).join(", ")})`);
  }
  return pricing;
}

/**
 * Conservative token estimate for a string. ASCII is counted at kCharsPerToken characters per token;
 * anything outside ASCII is counted as a whole token per character, because CJK text and emoji
 * routinely cost around one token each and dividing them by three would under-reserve.
 */
export function estimateTokensForText(text: string): number {
  let asciiChars = 0;
  let wideChars = 0;
  for (const character of text) {
    if (character.codePointAt(0)! < 128) asciiChars += 1;
    else wideChars += 1;
  }
  return Math.ceil(asciiChars / kCharsPerToken) + wideChars;
}

/**
 * How many input tokens one image costs.
 *
 * At `detail: "low"` it is a flat figure. Otherwise the image is scaled down to fit the long-side
 * bound and then, if its short side is still over the short-side bound, down again so the short side
 * meets it — scaling **down only**, which is what the provider does. The result is divided into
 * tiles and charged a base plus a per-tile rate.
 *
 * `detail: "auto"` is reserved at the **high** rate. The provider publishes an exact formula only for
 * explicit low and high, and the shared builder sends `auto`, so the harness assumes the expensive
 * branch. That is deliberately conservative: a reservation that is too small is the failure that
 * matters, and the README says so alongside the other ceiling caveats.
 */
export function estimateImageTokens(
  image: Pick<InputImageAccounting, "widthPx" | "heightPx" | "detail">, pricing: ImageTokenPricing
): number {
  if (image.detail === "low") return pricing.detailLowFlat;
  if (!Number.isInteger(image.widthPx) || !Number.isInteger(image.heightPx) ||
      image.widthPx <= 0 || image.heightPx <= 0) {
    throw new Error(`Cannot price a ${image.widthPx}×${image.heightPx} image: both dimensions must be ` +
      "positive integers. Image dimensions are read from the stored PNG when a representation is written.");
  }

  let { widthPx: width, heightPx: height } = image;
  const longSide = Math.max(width, height);
  if (longSide > pricing.maxLongSide) {
    const scale = pricing.maxLongSide / longSide;
    width *= scale;
    height *= scale;
  }
  const shortSide = Math.min(width, height);
  if (shortSide > pricing.maxShortSide) {
    const scale = pricing.maxShortSide / shortSide;
    width *= scale;
    height *= scale;
  }

  const tiles = Math.ceil(width / pricing.tileSize) * Math.ceil(height / pricing.tileSize);
  return pricing.base + pricing.perTile * tiles;
}

/**
 * Splits a message list into the parts the character heuristic prices and a count of the image parts
 * it must not.
 *
 * Image parts are dropped from the text side entirely: a base64 data URL for one screenshot runs to
 * about half a megabyte, which the ÷3 heuristic would read as ~170k input tokens — enough to blow
 * past any sane `--max-cost` before a single call went out.
 */
function splitMessagesForEstimate(messages: HarnessRequest["apiRequest"]["messages"]) {
  const textOnly: unknown[] = [];
  const imageParts: { detail?: string }[] = [];
  for (const message of messages) {
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      textOnly.push(message);
      continue;
    }
    const kept = content.filter((part) => {
      const typed = part as { type?: string; image_url?: { detail?: string } };
      if (typed?.type !== "image_url") return true;
      imageParts.push({ detail: typed.image_url?.detail });
      return false;
    });
    textOnly.push({ ...(message as object), content: kept });
  }
  return { textOnly, imageParts };
}

/**
 * Conservative input-token estimate: the message text plus the response schema, with every image part
 * priced by the image-token formula instead of by its characters.
 *
 * The estimator cannot get an image's dimensions from the request — for the Shutterbug modes the
 * message holds nothing but a hosted URL — so they come from `inputAccounting`, which travels beside
 * the payload. If the two ever disagree about how many images there are, or about the detail setting,
 * that is a wiring bug that would silently under-reserve, so it stops the run.
 */
export function estimateInputTokens(request: HarnessRequest, imagePricing?: ImageTokenPricing): number {
  const { apiRequest, inputAccounting } = request;
  const { textOnly, imageParts } = splitMessagesForEstimate(apiRequest.messages);

  if (imageParts.length !== inputAccounting.images.length) {
    throw new Error(`The request carries ${imageParts.length} image part(s) but ` +
      `${inputAccounting.images.length} accounting entr(y/ies). Input accounting must describe every ` +
      "image in the request, or the reservation would be estimated from base64 characters.");
  }
  let imageTokens = 0;
  if (imageParts.length > 0) {
    if (!imagePricing) {
      throw new Error("This request contains images, but no imageTokens pricing was supplied. " +
        "Add an imageTokens block for this model to src/pricing.json.");
    }
    inputAccounting.images.forEach((image, index) => {
      const sent = imageParts[index].detail;
      if (sent !== undefined && sent !== image.detail) {
        throw new Error(`Image ${index} is sent with detail "${sent}" but accounted for as ` +
          `"${image.detail}". The two must agree or the reservation prices the wrong thing.`);
      }
      imageTokens += estimateImageTokens(image, imagePricing);
    });
  }

  return estimateTokensForText(canonicalJson(textOnly)) +
    estimateTokensForText(canonicalJson(apiRequest.responseFormat)) +
    imageTokens;
}

export function priceTokens(promptTokens: number, completionTokens: number, pricing: ModelPricing): number {
  return (promptTokens / 1_000_000) * pricing.inputPerMTokUsd +
    (completionTokens / 1_000_000) * pricing.outputPerMTokUsd;
}

/**
 * The single reservation formula. Worst case is a full input estimate, a completion that runs all the
 * way to `max_completion_tokens`, and every retry being used.
 */
export function worstCaseUsd(request: HarnessRequest, pricing: ModelPricing, retries: number = kRetries): number {
  const inputTokens = estimateInputTokens(request, pricing.imageTokens);
  const outputTokens = request.apiRequest.generationSettings.max_completion_tokens;
  return priceTokens(inputTokens, outputTokens, pricing) * (1 + retries);
}

export interface Reservation {
  id: number;
  amountUsd: number;
}

/**
 * What dispatched attempts that returned nothing are charged: one attempt's share of the reservation
 * per attempt dispatched, up to the whole reservation. The reservation covered (1 + retries)
 * attempts, so a request that burns all three is charged the entire reservation, not a third of it.
 * A guess, but in the honest direction — see the README's note on the enforced bound.
 */
export function failedAttemptShareUsd(
  reservation: Reservation, failedAttempts: number, totalAttempts: number
): number {
  if (failedAttempts <= 0 || totalAttempts <= 0) return 0;
  return Math.min(reservation.amountUsd * (failedAttempts / totalAttempts), reservation.amountUsd);
}

export class CostCeilingExceeded extends Error {
  constructor(public readonly requested: number, public readonly remaining: number) {
    super(`Reserving $${requested.toFixed(4)} would exceed --max-cost; ` +
      `only $${remaining.toFixed(4)} is left. No further requests were dispatched.`);
    this.name = "CostCeilingExceeded";
  }
}

/**
 * Reservations are taken before dispatch and replaced by the actual cost on completion. Because
 * `reserve` is a single synchronous check-and-add, concurrent tasks cannot collectively overshoot
 * the ceiling: whichever call would cross it is refused before its request is ever sent.
 */
export class CostLedger {
  private nextId = 1;
  private outstanding = new Map<number, number>();
  private settledUsd = 0;

  constructor(public readonly maxCostUsd: number) {
    if (!(maxCostUsd > 0)) throw new Error(`--max-cost must be a positive number, got ${maxCostUsd}`);
  }

  /** Reserved (outstanding) plus settled — the most this run could still end up costing. */
  get committedUsd(): number {
    let total = this.settledUsd;
    for (const amount of this.outstanding.values()) total += amount;
    return total;
  }

  get incurredUsd(): number {
    return this.settledUsd;
  }

  get remainingUsd(): number {
    return this.maxCostUsd - this.committedUsd;
  }

  /** The peak of `committedUsd`, i.e. the total that was ever reserved for dispatched requests. */
  private peakReservedUsd = 0;

  get reservedPeakUsd(): number {
    return this.peakReservedUsd;
  }

  /**
   * Set when a settled actual cost pushes the committed total past the ceiling. Reservations are
   * conservative, so this should not happen — but the input estimate is a character heuristic, not a
   * tokenizer, so it can. Workers stop scheduling new requests once it trips.
   */
  private exceeded = false;

  get hasExceededCeiling(): boolean {
    return this.exceeded;
  }

  /** How far past the ceiling the run ended up, or 0. */
  get overshootUsd(): number {
    return Math.max(0, this.committedUsd - this.maxCostUsd);
  }

  reserve(amountUsd: number): Reservation {
    if (this.committedUsd + amountUsd > this.maxCostUsd) {
      throw new CostCeilingExceeded(amountUsd, this.remainingUsd);
    }
    const reservation = { id: this.nextId++, amountUsd };
    this.outstanding.set(reservation.id, amountUsd);
    this.peakReservedUsd = Math.max(this.peakReservedUsd, this.committedUsd);
    return reservation;
  }

  /** Replaces a reservation with what the call actually cost. */
  settle(reservation: Reservation, actualUsd: number): void {
    if (!this.outstanding.delete(reservation.id)) {
      throw new Error(`Reservation ${reservation.id} was already settled or released`);
    }
    this.settledUsd += actualUsd;
    if (this.committedUsd > this.maxCostUsd) this.exceeded = true;
  }

  /**
   * Drops a reservation for a request that was never dispatched. A request that *was* dispatched and
   * then failed must not come through here: the provider may have billed it. Use settleFailedAttempt.
   */
  release(reservation: Reservation): void {
    this.outstanding.delete(reservation.id);
  }

  /**
   * Settles a dispatched request that failed before returning usage. The reservation covered
   * (1 + retries) attempts; charging one attempt's share per attempt dispatched — the whole
   * reservation if every attempt was used — keeps a run of failures from looking free, without
   * pretending we know what the provider actually billed.
   */
  settleFailedAttempt(reservation: Reservation, attempts: number, totalAttempts: number): void {
    this.settle(reservation, failedAttemptShareUsd(reservation, attempts, totalAttempts));
  }

  /**
   * Settles a request that eventually succeeded after one or more dispatched attempts returned
   * nothing. The earlier attempts are charged on the same basis as a request that never succeeded —
   * they went out, so the provider may have billed them. Charging only the final response would make
   * the two paths disagree about the identical event and let real spend drift past the ceiling.
   */
  settleAfterFailedAttempts(
    reservation: Reservation, actualUsd: number, failedAttempts: number, totalAttempts: number
  ): void {
    this.settle(reservation, actualUsd + failedAttemptShareUsd(reservation, failedAttempts, totalAttempts));
  }
}
