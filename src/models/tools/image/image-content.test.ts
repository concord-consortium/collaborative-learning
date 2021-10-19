import { defaultImageContent, ImageContentModel } from "./image-content";
import placeholderImage from "../../../assets/image_placeholder.png";

describe("ImageContent", () => {
  it("should handle empty change lists", () => {
    const content = ImageContentModel.create({ changes: [] });
    expect(content.isUserResizable).toBe(true);
    expect(content.changeCount).toBe(0);
    expect(content.filename).toBeUndefined();
    expect(content.url).toBeUndefined();
    expect(content.hasValidImage).toBe(false);
  });

  it("should support default placeholder content", () => {
    const content = defaultImageContent();
    expect(content.isUserResizable).toBe(true);
    expect(content.changeCount).toBe(1);
    expect(content.filename).toBeUndefined();
    expect(content.url).toBe(placeholderImage);
    expect(content.hasValidImage).toBe(false);
  });

  it("should support default non-placeholder content", () => {
    const content = defaultImageContent("my/image/url");
    expect(content.isUserResizable).toBe(true);
    expect(content.changeCount).toBe(1);
    expect(content.filename).toBeUndefined();
    expect(content.url).toBe("my/image/url");
    expect(content.hasValidImage).toBe(true);
  });

  it("should add changes", () => {
    const content = ImageContentModel.create({ changes: [] });
    content.setUrl("my/image/url", "my/image/filename");
    expect(content.isUserResizable).toBe(true);
    expect(content.changeCount).toBe(1);
    expect(content.filename).toBe("my/image/filename");
    expect(content.url).toBe("my/image/url");
    expect(content.hasValidImage).toBe(true);
  });

  it("should update changes", () => {
    const content = ImageContentModel.create({ changes: [] });
    content.setUrl("my/image/firstUrl");
    content.setUrl("my/image/url");
    const origChanges = content.changes.toJSON();

    content.updateImageUrl("my/image/url", "");
    expect(content.changes.toJSON()).toEqual(origChanges);
    content.updateImageUrl("", "my/image/newUrl");
    expect(content.changes.toJSON()).toEqual(origChanges);
    content.updateImageUrl("my/image/url", "my/image/url");
    expect(content.changes.toJSON()).toEqual(origChanges);

    content.updateImageUrl("my/image/url", "my/image/newUrl");
    expect(content.isUserResizable).toBe(true);
    expect(content.changeCount).toBe(2);
    expect(content.url).toBe("my/image/newUrl");
    expect(content.hasValidImage).toBe(true);
  });
});
