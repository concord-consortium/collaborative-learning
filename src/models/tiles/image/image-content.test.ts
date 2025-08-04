import { defaultImageContent, ImageContentModel } from "./image-content";
import { PLACEHOLDER_IMAGE_PATH } from "../../../utilities/image-constants";

describe("ImageContent", () => {
  it("should handle empty change lists", () => {
    const content = ImageContentModel.create();
    expect(content.isUserResizable).toBe(true);
    expect(content.filename).toBeUndefined();
    expect(content.url).toBeUndefined();
    expect(content.hasValidImage).toBe(false);
  });

  it("should support default placeholder content", () => {
    const content = defaultImageContent();
    expect(content.isUserResizable).toBe(true);
    expect(content.filename).toBeUndefined();
    expect(content.url).toBe(PLACEHOLDER_IMAGE_PATH);
    expect(content.hasValidImage).toBe(false);
  });

  it("should support default non-placeholder content", () => {
    const content = defaultImageContent({ url: "my/image/url" });
    expect(content.isUserResizable).toBe(true);
    expect(content.filename).toBeUndefined();
    expect(content.url).toBe("my/image/url");
    expect(content.hasValidImage).toBe(true);
  });

  it("should add changes", () => {
    const content = ImageContentModel.create();
    content.setUrl("my/image/url", "my/image/filename");
    expect(content.isUserResizable).toBe(true);
    expect(content.filename).toBe("my/image/filename");
    expect(content.url).toBe("my/image/url");
    expect(content.hasValidImage).toBe(true);
  });

  it("should update changes", () => {
    const content = ImageContentModel.create();
    const firstUrl = "my/image/firstUrl";
    const secondUrl = "my/image/secondUrl";
    content.setUrl(firstUrl);

    content.updateImageUrl(firstUrl, "");
    expect(content.url).toEqual(firstUrl);
    content.updateImageUrl("", secondUrl);
    expect(content.url).toEqual(firstUrl);
    content.updateImageUrl(secondUrl, secondUrl);
    expect(content.url).toEqual(firstUrl);

    content.updateImageUrl(firstUrl, secondUrl);
    expect(content.isUserResizable).toBe(true);
    expect(content.url).toBe(secondUrl);
    expect(content.hasValidImage).toBe(true);
  });
});
