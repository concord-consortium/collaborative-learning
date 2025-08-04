import { isPlaceholderImage } from "./image-utils";
import { PLACEHOLDER_IMAGE_PATH, PLACEHOLDER_ORG_IMAGE_PATH } from "./image-constants";

describe("isPlaceholderImage", () => {
  it("should return true for placeholder image URL", () => {
    expect(isPlaceholderImage(PLACEHOLDER_IMAGE_PATH)).toBe(true);
  });

  it("should return true for original placeholder image URL", () => {
    expect(isPlaceholderImage(PLACEHOLDER_ORG_IMAGE_PATH)).toBe(true);
  });

  it("should return false for non-placeholder image URL", () => {
    const nonPlaceholderUrl = "https://example.com/image.jpg";
    expect(isPlaceholderImage(nonPlaceholderUrl)).toBe(false);
  });

  it("should return false for undefined URL", () => {
    expect(isPlaceholderImage(undefined)).toBe(false);
  });

  it("should return false for empty string URL", () => {
    expect(isPlaceholderImage("")).toBe(false);
  });

  it("should return false for null URL", () => {
    expect(isPlaceholderImage(null as any)).toBe(false);
  });

  it("should return false for URLs that are similar but not exact matches", () => {
    const similarUrl = PLACEHOLDER_IMAGE_PATH + "?query=param";
    expect(isPlaceholderImage(similarUrl)).toBe(false);
  });

  it("should return false for URLs with query parameters", () => {
    const urlWithParams = PLACEHOLDER_IMAGE_PATH + "?v=123&t=456";
    expect(isPlaceholderImage(urlWithParams)).toBe(false);
  });

  it("should return false for URLs with hash fragments", () => {
    const urlWithHash = PLACEHOLDER_IMAGE_PATH + "#section";
    expect(isPlaceholderImage(urlWithHash)).toBe(false);
  });

  it("should return false for completely different URLs", () => {
    const differentUrls = [
      // eslint-disable-next-line max-len
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "https://example.com/placeholder.png",
      "file:///path/to/image.png",
      "blob:https://example.com/12345678-1234-1234-1234-123456789012"
    ];

    differentUrls.forEach(url => {
      expect(isPlaceholderImage(url)).toBe(false);
    });
  });
});
