import { parseDocumentContent } from "../src/parse-document-content";
import { buildFirebaseImageUrl, parseFirebaseImageUrl, replaceAll } from "../../shared/shared-utils";
import { specDocumentContent } from "./test-utils";
import sharedDatasetExample from "./shared-dataset-example";

describe("parseDocumentContent", () => {

  const identityCanonicalize = (url: string) => Promise.resolve(url);

  it("should parse empty content", async () => {
    expect(await parseDocumentContent("", identityCanonicalize)).toEqual({ content: "", images: {} });
  });

  it("should parse content without images", async () => {
    const kEmptyContent = specDocumentContent();
    expect(await parseDocumentContent(kEmptyContent, identityCanonicalize)).toEqual({ content: kEmptyContent, images: {} });
  });

  it("should parse an old single Image tile with legacy url", async () => {
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

  it("should parse a new single Image tile with legacy url", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl = buildFirebaseImageUrl(kClassHash, "image-key");
    const { legacyUrl } = parseFirebaseImageUrl(canonicalUrl);
    const originalContent = specDocumentContent([
      { type: "Image", url: legacyUrl }
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

  it("should support multiple images in an old Drawing tile", async () => {
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

  it("should support multiple images in a new Drawing tile", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl1 = buildFirebaseImageUrl(kClassHash, "image-1");
    const canonicalUrl2 = buildFirebaseImageUrl(kClassHash, "image-2");
    const { legacyUrl: legacyUrl1 } = parseFirebaseImageUrl(canonicalUrl1);
    const { legacyUrl: legacyUrl2 } = parseFirebaseImageUrl(canonicalUrl2);
    const originalContent = specDocumentContent([
      { type: "Drawing", objects: [
        { type: "image", url: legacyUrl1, width: 100, height: 100 },
        { type: "image", url: legacyUrl2, width: 100, height: 100 }
      ]}
    ]);
    const updatedContent = originalContent.replace(legacyUrl1, canonicalUrl1).replace(legacyUrl2, canonicalUrl2);
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseDocumentContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images: { [legacyUrl1]: canonicalUrl1, [legacyUrl2]: canonicalUrl2 } });
  });

  it("should support an image in a new Geometry tile", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl1 = buildFirebaseImageUrl(kClassHash, "image-1");
    const { legacyUrl: legacyUrl1 } = parseFirebaseImageUrl(canonicalUrl1);
    const originalContent = specDocumentContent([
      { type: "Geometry",
        board: {
          xAxis: { name: "x", label: "x", min: -2, unit: 18.3, range: 26.2 },
          yAxis: { name: "y", label: "y", min: -1, unit: 18.3, range: 17.5 }
        },
        bgImage: { type: "image", id: "WlCWbMo8jT79iCkO", x: 0, y: 0,
                   url: legacyUrl1, width: 27.3, height: 23.8
        },
        objects: {}
      }
    ]);
    const updatedContent = originalContent.replace(legacyUrl1, canonicalUrl1);
    const canonicalize = (url: string) => {
      const { imageKey = "" } = parseFirebaseImageUrl(url);
      return Promise.resolve(buildFirebaseImageUrl(kClassHash, imageKey));
    };
    expect(await parseDocumentContent(originalContent, canonicalize))
      .toEqual({ content: updatedContent, images: { [legacyUrl1]: canonicalUrl1 } });
  });

  it("should support multiple images in a shared dataset", async () => {
    const kClassHash = "class-hash";
    const canonicalUrl1 = buildFirebaseImageUrl(kClassHash, "image-1");
    const canonicalUrl2 = buildFirebaseImageUrl(kClassHash, "image-2");
    const { legacyUrl: legacyUrl1 } = parseFirebaseImageUrl(canonicalUrl1);
    const { legacyUrl: legacyUrl2 } = parseFirebaseImageUrl(canonicalUrl2);
    // In this case we've hardcoded the legacyUrl1(ccimg://fbrtdb.concord.org/image-1) and
    // legacyUrl2(ccimg://fbrtdb.concord.org/image-2) into the content
    const originalContent = JSON.stringify(sharedDatasetExample);
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
    const canonicalUrls = [0, 1, 2, 3, 4, 5].map(i => buildFirebaseImageUrl(kClassHash, `image-${i}`));
    const legacyUrls = canonicalUrls.map(url => parseFirebaseImageUrl(url).legacyUrl);
    const unconvertedCanonicalUrl = buildFirebaseImageUrl(kClassHash, "image-unconverted");
    const unconvertedLegacyUrl = parseFirebaseImageUrl(unconvertedCanonicalUrl).legacyUrl;
    const originalContent = specDocumentContent([
      { type: "Drawing", changes: [{ url: legacyUrls[0] }, { url: legacyUrls[1] }] },
      { type: "Drawing", objects: [
        { type: "image", url: legacyUrls[2], width: 100, height: 100 },
        { type: "image", url: legacyUrls[3], width: 100, height: 100 }
      ]},
      { type: "Image", changes: [{ url: unconvertedLegacyUrl }, { url: legacyUrls[4] }] },
      { type: "Image", url: legacyUrls[5] }
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
