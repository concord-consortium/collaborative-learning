import { parseSupportContent } from "../src/parse-support-content";
import { buildFirebaseImageUrl, parseFirebaseImageUrl } from "../src/shared";
import { replaceAll } from "../src/shared-utils";

describe("parseSupportContent", () => {

  const identityCanonicalize = (url: string) => Promise.resolve(url);

  it("should parse empty content", async () => {
    expect(await parseSupportContent("", identityCanonicalize)).toEqual({ content: "", images: {} });
  });

  it("should parse content without images", async () => {
    const kTextContent = "Some random text without image urls";
    expect(await parseSupportContent(kTextContent, identityCanonicalize)).toEqual({ content: kTextContent, images: {} });
  });

  it("should parse a single Image tile with legacy url", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl = buildFirebaseImageUrl(kClassHash, "image-key");
    const { legacyUrl } = parseFirebaseImageUrl(canonicalUrl);
    const originalContent = JSON.stringify({
      tiles: [
        { type: "Image", content: JSON.stringify([{ url: legacyUrl }]) }
      ]
    });
    const updatedContent = originalContent.replace(legacyUrl, canonicalUrl);
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseSupportContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images: { [legacyUrl]: canonicalUrl } });
  });

  it("should ignore replaced images in a single Image tile with legacy url", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl = buildFirebaseImageUrl(kClassHash, "image-key");
    const { legacyUrl } = parseFirebaseImageUrl(canonicalUrl);
    const originalContent = JSON.stringify({
      tiles: [
        { type: "Image", content: JSON.stringify([{ url: legacyUrl }]) }
      ]
    });
    const updatedContent = originalContent.replace(legacyUrl, canonicalUrl);
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseSupportContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images: { [legacyUrl]: canonicalUrl } });
  });

  it("should support multiple images in a Drawing tile", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl1 = buildFirebaseImageUrl(kClassHash, "image-1");
    const canonicalUrl2 = buildFirebaseImageUrl(kClassHash, "image-2");
    const { legacyUrl: legacyUrl1 } = parseFirebaseImageUrl(canonicalUrl1);
    const { legacyUrl: legacyUrl2 } = parseFirebaseImageUrl(canonicalUrl2);
    const originalContent = JSON.stringify({
      tiles: [
        { type: "Drawing", content: JSON.stringify([{ url: legacyUrl1 }, { url: legacyUrl2 }]) }
      ]
    });
    const updatedContent = originalContent.replace(legacyUrl1, canonicalUrl1).replace(legacyUrl2, canonicalUrl2);
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseSupportContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images: { [legacyUrl1]: canonicalUrl1, [legacyUrl2]: canonicalUrl2 } });
  });

  it("should support multiple images in multiple tiles", async () => {
    const kClassHash = "class-hash";
    const canonicalUrls = [1, 2, 3].map(i => buildFirebaseImageUrl(kClassHash, `image-${i}`));
    const legacyUrls = canonicalUrls.map(url => parseFirebaseImageUrl(url).legacyUrl);
    const originalContent = JSON.stringify({
      tiles: [
        { type: "Drawing", content: JSON.stringify([{ url: legacyUrls[0] }, { url: legacyUrls[1] }]) },
        { type: "Image", content: JSON.stringify([{ url: legacyUrls[0] }, { url: legacyUrls[2] }]) }
      ]
    });
    let updatedContent = originalContent;
    const images: Record<string, string> = {};
    legacyUrls.forEach((legacyUrl, i) => {
      images[legacyUrl] = canonicalUrls[i];
      updatedContent = replaceAll(updatedContent, legacyUrl, canonicalUrls[i]);
    });
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseSupportContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images });
  });

});
