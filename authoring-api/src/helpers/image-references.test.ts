import {buildUsageMap, extractImageKeys, rewriteImageReference} from "./image-references";

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
});
