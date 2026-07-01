import {
  buildUsageMap, extractImageKeys, isPathSafeImageFileName, isValidImageFileName, isValidUnitCode,
  rewriteImageReference,
} from "./image-references";

const contentWith = (...refs: string[]) =>
  JSON.stringify({
    tiles: refs.map((ref, i) => ({
      id: `tile-${i}`,
      content: {type: "Image", url: ref, filename: ref},
    })),
  });

describe("extractImageKeys", () => {
  it("finds images referenced as {unit}/images/{file}", () => {
    const text = contentWith("sas/images/diagram-1.png", "sas/images/photo.jpg");
    expect(extractImageKeys("sas", text).sort()).toEqual([
      "images/diagram-1.png",
      "images/photo.jpg",
    ]);
  });

  it("de-duplicates an image referenced multiple times in one file", () => {
    // url + filename both carry the same reference, and it may appear in several tiles
    const text = contentWith("sas/images/photo.jpg", "sas/images/photo.jpg");
    expect(extractImageKeys("sas", text)).toEqual(["images/photo.jpg"]);
  });

  it("ignores references to other units' images", () => {
    const text = contentWith("sas/images/mine.png", "msa/images/theirs.png");
    expect(extractImageKeys("sas", text)).toEqual(["images/mine.png"]);
  });

  it("does not match a unit code that is only a suffix of another unit's prefix", () => {
    // "xsas/images/..." must not be counted as a "sas" reference
    const text = contentWith("xsas/images/photo.jpg");
    expect(extractImageKeys("sas", text)).toEqual([]);
  });

  it("matches the bare {unit}/images token inside a curriculum/ prefixed path", () => {
    const text = contentWith("curriculum/sas/images/photo.jpg");
    expect(extractImageKeys("sas", text)).toEqual(["images/photo.jpg"]);
  });

  it("returns nothing when there are no image references", () => {
    expect(extractImageKeys("sas", JSON.stringify({tiles: []}))).toEqual([]);
  });

  it("detects legacy names containing '&' (which the runtime can reference) and stops at the quote", () => {
    // "C&S_1-1.png" is a real referenceable image; the scanner must count it, not truncate at "&".
    const text = contentWith("sas/images/C&S_1-1.png");
    expect(extractImageKeys("sas", text)).toEqual(["images/C&S_1-1.png"]);
  });

  it("detects legacy names with other punctuation the runtime accepts (not truncated)", () => {
    // ( ) % + ' , and non-ASCII are all part of a real referenceable name; capturing only up to the
    // JSON string delimiter keeps their usage counts correct (previously these were truncated).
    const text = contentWith(
      "sas/images/photo(2).png", "sas/images/100%.png", "sas/images/a+b's,c.png", "sas/images/café.png",
    );
    expect(extractImageKeys("sas", text).sort()).toEqual([
      "images/100%.png",
      "images/a+b's,c.png",
      "images/café.png",
      "images/photo(2).png",
    ]);
  });
});

describe("buildUsageMap", () => {
  const imageKeys = ["images/used.png", "images/unused.png", "images/shared.png"];
  const perFile = [
    {path: "investigation-0/problem-1/introduction/content.json", keys: ["images/used.png", "images/shared.png"]},
    {path: "teacher-guide/investigation-0/problem-1/launch/content.json", keys: ["images/shared.png"]},
  ];

  it("maps each library image to the paths that reference it", () => {
    const usages = buildUsageMap(imageKeys, perFile);
    expect(usages["images/used.png"]).toEqual([
      "investigation-0/problem-1/introduction/content.json",
    ]);
    expect(usages["images/shared.png"]).toEqual([
      "investigation-0/problem-1/introduction/content.json",
      "teacher-guide/investigation-0/problem-1/launch/content.json",
    ]);
  });

  it("includes unused images with an empty list", () => {
    const usages = buildUsageMap(imageKeys, perFile);
    expect(usages["images/unused.png"]).toEqual([]);
  });

  it("ignores referenced images that are not in the library list", () => {
    const usages = buildUsageMap(["images/used.png"], [
      {path: "a/content.json", keys: ["images/used.png", "images/stray.png"]},
    ]);
    expect(Object.keys(usages)).toEqual(["images/used.png"]);
  });
});

describe("rewriteImageReference", () => {
  it("rewrites both url and filename references, preserving any prefix", () => {
    const text = JSON.stringify({
      tiles: [{content: {type: "Image", url: "sas/images/old.png", filename: "sas/images/old.png"}}],
    });
    const {text: out, changed} = rewriteImageReference("sas", text, "old.png", "new.png");
    expect(changed).toBe(true);
    expect(out).toContain("sas/images/new.png");
    expect(out).not.toContain("sas/images/old.png");
  });

  it("does not touch a different image whose name shares a prefix", () => {
    const text = JSON.stringify({url: "sas/images/old.png", other: "sas/images/old-version.png"});
    const {text: out} = rewriteImageReference("sas", text, "old.png", "new.png");
    expect(out).toContain("sas/images/new.png");
    expect(out).toContain("sas/images/old-version.png");
  });

  it("reports no change when the image is not referenced", () => {
    const text = JSON.stringify({url: "sas/images/something-else.png"});
    const {changed} = rewriteImageReference("sas", text, "old.png", "new.png");
    expect(changed).toBe(false);
  });

  it("rewrites a legacy '&' name to a clean one", () => {
    const text = JSON.stringify({url: "sas/images/C&S_1-1.png", filename: "sas/images/C&S_1-1.png"});
    const {text: out, changed} = rewriteImageReference("sas", text, "C&S_1-1.png", "cs_1-1.png");
    expect(changed).toBe(true);
    expect(out).toContain("sas/images/cs_1-1.png");
    expect(out).not.toContain("C&S_1-1.png");
  });

  it("rewrites a legacy name with parentheses (which regex-escaping must handle)", () => {
    const text = JSON.stringify({url: "sas/images/photo(2).png"});
    const {text: out, changed} = rewriteImageReference("sas", text, "photo(2).png", "photo-2.png");
    expect(changed).toBe(true);
    expect(out).toContain("sas/images/photo-2.png");
    expect(out).not.toContain("photo(2).png");
  });
});

describe("isValidImageFileName", () => {
  it("accepts alphanumerics, dot, dash, and underscore", () => {
    expect(isValidImageFileName("diagram-1.png")).toBe(true);
    expect(isValidImageFileName("My_Image.2.JPG")).toBe(true);
  });

  it("rejects path separators, traversal, and empty names", () => {
    expect(isValidImageFileName("")).toBe(false);
    expect(isValidImageFileName("../secret.png")).toBe(false);
    expect(isValidImageFileName("sub/dir/x.png")).toBe(false);
    expect(isValidImageFileName("a b.png")).toBe(false);
    expect(isValidImageFileName("x%2F..%2Fy.png")).toBe(false);
  });

  it("still rejects '&' — the naming policy stays strict even though the scanner now detects it", () => {
    expect(isValidImageFileName("C&S_1-1.png")).toBe(false);
  });

  it("requires a real image extension so the renamed file still resolves at runtime", () => {
    // The runtime resolver needs a dot + 3-letter extension; an otherwise-safe name without one
    // would move the blob and rewrite references to a token that renders nowhere.
    expect(isValidImageFileName("diagram-v2")).toBe(false);
    expect(isValidImageFileName("foo.x")).toBe(false);
    expect(isValidImageFileName("diagram-v2.png")).toBe(true);
  });
});

describe("isValidUnitCode", () => {
  it("accepts simple unit slugs", () => {
    expect(isValidUnitCode("sas")).toBe(true);
    expect(isValidUnitCode("moving-straight-ahead")).toBe(true);
  });

  it("rejects slashes and traversal", () => {
    expect(isValidUnitCode("")).toBe(false);
    expect(isValidUnitCode("../other")).toBe(false);
    expect(isValidUnitCode("a/b")).toBe(false);
  });
});

describe("isPathSafeImageFileName", () => {
  const backslash = String.fromCharCode(92);
  const tab = String.fromCharCode(9);

  it("accepts messy legacy names that the strict allowlist would reject", () => {
    // These are exactly the names rename needs to operate on to clean them up.
    expect(isPathSafeImageFileName("spaghetti plot.png")).toBe(true);
    expect(isPathSafeImageFileName("C&S_1-1_LimasGroup.png")).toBe(true);
    expect(isPathSafeImageFileName("screenshot at 8.24.34 am.png")).toBe(true);
    // and ordinary clean names too
    expect(isPathSafeImageFileName("diagram-1.png")).toBe(true);
  });

  it("rejects anything that could escape the images/ directory", () => {
    expect(isPathSafeImageFileName("")).toBe(false);
    expect(isPathSafeImageFileName(".")).toBe(false);
    expect(isPathSafeImageFileName("..")).toBe(false);
    expect(isPathSafeImageFileName("sub/dir/x.png")).toBe(false);
    expect(isPathSafeImageFileName(`a${backslash}b.png`)).toBe(false);
    expect(isPathSafeImageFileName(`a${tab}b.png`)).toBe(false);
  });
});
