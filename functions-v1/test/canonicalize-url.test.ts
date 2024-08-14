import { canonicalizeUrl } from "../src/canonicalize-url";
import { buildFirebaseImageUrl } from "../src/shared-utils";

describe("canonicalizeUrl", () => {
  it("should simply return invalid urls", async () => {
    expect(await canonicalizeUrl("", "", "")).toBe("");
    expect(await canonicalizeUrl("bogus", "class-hash", "firestore-root")).toBe("bogus");
  });

  it("should simply return canonical urls", async () => {
    const canonicalUrl = buildFirebaseImageUrl("image-class-hash", "image-key");
    expect(await canonicalizeUrl(canonicalUrl, "class-hash", "firestore-root")).toBe(canonicalUrl);
  });
});
