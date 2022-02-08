import { parseDocumentContent } from "../src/parse-document-content";
import { buildFirebaseImageUrl, parseFirebaseImageUrl, replaceAll } from "../src/shared-utils";
import { specDocumentContent } from "./test-utils";

describe("parseDocumentContent", () => {

  const identityCanonicalize = (url: string) => Promise.resolve(url);

  it("should parse empty content", async () => {
    expect(await parseDocumentContent("", identityCanonicalize)).toEqual({ content: "", images: {} });
  });

  it("should parse content without images", async () => {
    const kEmptyContent = specDocumentContent();
    expect(await parseDocumentContent(kEmptyContent, identityCanonicalize)).toEqual({ content: kEmptyContent, images: {} });
  });

  it("should parse a single Image tile with legacy url", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl = buildFirebaseImageUrl(kClassHash, "image-key");
    const { legacyUrl } = parseFirebaseImageUrl(canonicalUrl);
    const originalContent = specDocumentContent([
      { type: "Image", changes: [{ url: legacyUrl }] }
    ]);
    const updatedContent = originalContent.replace(legacyUrl, canonicalUrl);
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseDocumentContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images: { [legacyUrl]: canonicalUrl } });
  });

  it("should ignore replaced images in a single Image tile with legacy urls", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl1 = buildFirebaseImageUrl(kClassHash, "image-1");
    const canonicalUrl2 = buildFirebaseImageUrl(kClassHash, "image-2");
    const { legacyUrl: legacyUrl1 } = parseFirebaseImageUrl(canonicalUrl1);
    const { legacyUrl: legacyUrl2 } = parseFirebaseImageUrl(canonicalUrl2);
    const originalContent = specDocumentContent([
      { type: "Image", changes: [{ url: legacyUrl1 }, { url: legacyUrl2 }] }
    ]);
    const updatedContent = originalContent.replace(legacyUrl2, canonicalUrl2);
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseDocumentContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images: { [legacyUrl2]: canonicalUrl2 } });
  });

  it("should support multiple images in a Drawing tile", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl1 = buildFirebaseImageUrl(kClassHash, "image-1");
    const canonicalUrl2 = buildFirebaseImageUrl(kClassHash, "image-2");
    const { legacyUrl: legacyUrl1 } = parseFirebaseImageUrl(canonicalUrl1);
    const { legacyUrl: legacyUrl2 } = parseFirebaseImageUrl(canonicalUrl2);
    const originalContent = specDocumentContent([
      { type: "Drawing", changes: [{ url: legacyUrl1 }, { url: legacyUrl2 }] }
    ]);
    const updatedContent = originalContent.replace(legacyUrl1, canonicalUrl1).replace(legacyUrl2, canonicalUrl2);
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseDocumentContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images: { [legacyUrl1]: canonicalUrl1, [legacyUrl2]: canonicalUrl2 } });
  });

  it("should support multiple images in multiple tiles", async () => {
    const kClassHash = "class-hash";
    const canonicalUrls = [1, 2, 3].map(i => buildFirebaseImageUrl(kClassHash, `image-${i}`));
    const legacyUrls = canonicalUrls.map(url => parseFirebaseImageUrl(url).legacyUrl);
    const originalContent = specDocumentContent([
      { type: "Drawing", changes: [{ url: legacyUrls[0] }, { url: legacyUrls[1] }] },
      { type: "Image", changes: [{ url: legacyUrls[0] }, { url: legacyUrls[2] }] }
    ]);
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
    expect(await parseDocumentContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images });
  });

});
