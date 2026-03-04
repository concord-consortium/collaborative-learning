import { sanitizeFileName } from "./sanitize-filename";

describe("sanitizeFileName", () => {
  it("replaces spaces with hyphens", () => {
    expect(sanitizeFileName("hl 2.3.png")).toBe("hl-2.3.png");
  });

  it("replaces parentheses and spaces", () => {
    expect(sanitizeFileName("image (1).png")).toBe("image-1.png");
  });

  it("falls back to 'image' for unicode-only basename", () => {
    expect(sanitizeFileName("图片.png")).toBe("image.png");
  });

  it("returns valid filenames unchanged", () => {
    expect(sanitizeFileName("diagram.png")).toBe("diagram.png");
  });

  it("collapses multiple consecutive invalid chars into a single hyphen", () => {
    expect(sanitizeFileName("a   b.png")).toBe("a-b.png");
  });

  it("trims leading/trailing invalid chars from basename", () => {
    expect(sanitizeFileName(" hello .png")).toBe("hello.png");
  });

  it("falls back to 'image' when basename is only invalid chars", () => {
    expect(sanitizeFileName("   .png")).toBe("image.png");
  });

  it("handles filenames with no extension", () => {
    expect(sanitizeFileName("my file")).toBe("my-file");
  });

  it("preserves multiple dots in valid filenames", () => {
    expect(sanitizeFileName("my.image.file.png")).toBe("my.image.file.png");
  });

  it("falls back to 'image' when basename is only hyphens", () => {
    expect(sanitizeFileName("---.jpg")).toBe("image.jpg");
  });

  it("falls back to 'image' when basename is only dots", () => {
    expect(sanitizeFileName(". .png")).toBe("image.png");
  });

  it("strips bare trailing dot", () => {
    expect(sanitizeFileName("foo.")).toBe("foo");
  });

  it("strips extension that sanitizes to just a dot", () => {
    expect(sanitizeFileName("foo.$$$")).toBe("foo");
  });

  it("strips trailing dot from basename when extension is dropped", () => {
    expect(sanitizeFileName("foo..$$$")).toBe("foo");
  });

  it("strips leading dots from basename", () => {
    expect(sanitizeFileName(".bashrc")).toBe("bashrc");
  });

  it("strips leading dots from basename with extension", () => {
    expect(sanitizeFileName(".foo.png")).toBe("foo.png");
  });
});
