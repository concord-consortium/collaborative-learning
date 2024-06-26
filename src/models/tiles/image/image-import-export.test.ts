import {
  exportImageTileSpec, convertLegacyImageTile, isLegacyImageTileImport,
} from "./image-import-export";

describe("isLegacyImageTileImport", () => {
  it("should work as expected", () => {
    expect(isLegacyImageTileImport(null)).toBe(false);
    expect(isLegacyImageTileImport({})).toBe(false);
    expect(isLegacyImageTileImport({ type: "Image" })).toBe(false);
    expect(isLegacyImageTileImport({ type: "Image", url: "foo" })).toBe(false);
    expect(isLegacyImageTileImport({ type: "Image", url: "foo", changes: [] })).toBe(true);
  });
});

describe("convertImageTile", () => {
  it("should convert legacy image tile correctly", () => {
    const input = {
      type: "Image" as const,
      url: "my/image/url",
      changes: [
        "{\"operation\":\"update\",\"url\":\"https://collaborative-learning.concord.org/branch/master/assets/images/image_placeholder.png\"}",
        "{\"operation\":\"update\",\"url\":\"ccimg://myLegacyUrl\",\"filename\":\"img2.jpg\"}"
      ]

    };
    const result = convertLegacyImageTile(input);
    expect(result.type).toBe("Image");
    expect(result.url).toBe("ccimg://myLegacyUrl");
    expect(result.fileName).toBe("img2.jpg");
  });
});

describe("Image export with default options", () => {
  it("should export placeholder image when no image has been uploaded", () => {
    const url = "assets/images/image_placeholder.png";
        expect(exportImageTileSpec(url))
            .toEqual(`{\n  "type": "Image",\n  "url": "${url}"\n}`);
  });
});

describe("Image export with uploaded image", () => {
  it("should export uploaded image", () => {
    const url = "https://collaborative-learning.concord.org/uploaded-image.jpg";
    const filename = "https://collaborative-learning.concord.org/uploaded-image.jpg";
        expect(exportImageTileSpec(url, filename))
            .toEqual(`{\n  "type": "Image",\n  "url": "${url}",\n  "filename": "${filename}"\n}`);
  });
});
