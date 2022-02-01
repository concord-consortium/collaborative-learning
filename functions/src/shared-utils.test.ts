import { buildFirebaseImageUrl, matchAll, parseFirebaseImageUrl, replaceAll, safeJsonParse } from "./shared-utils";

describe("matchAll", () => {
  // ignore non-serializable properties (e.g. `index`)
  const clean = (input: any) => JSON.parse(JSON.stringify(input));

  it("should return first match if g flag not specified", () => {
    expect(clean(matchAll(/foo/, ""))).toEqual([]);
    expect(clean(matchAll(/foo/, "bar"))).toEqual([]);
    expect(clean(matchAll(/foo/, "foo"))).toEqual([["foo"]]);
    expect(clean(matchAll(/foo/, "foo foo"))).toEqual([["foo"]]);
    expect(clean(matchAll(/f(oo)/, "foo foo"))).toEqual([["foo", "oo"]]);
  });

  it("should return all matches if g flag specified", () => {
    expect(clean(matchAll(/foo/g, ""))).toEqual([]);
    expect(clean(matchAll(/foo/g, "bar"))).toEqual([]);
    expect(clean(matchAll(/foo/g, "foo"))).toEqual([["foo"]]);
    expect(clean(matchAll(/foo/g, "foo foo"))).toEqual([["foo"], ["foo"]]);
    expect(clean(matchAll(/f(oo)/g, "foo foo"))).toEqual([["foo", "oo"], ["foo", "oo"]]);
  });
});

describe("replaceAll", () => {
  it("should work as expected", () => {
    expect(replaceAll("", "foo", "bar")).toBe("");
    expect(replaceAll("baz", "foo", "bar")).toBe("baz");
    expect(replaceAll("foo", "foo", "bar")).toBe("bar");
    expect(replaceAll("foo foo", "foo", "bar")).toBe("bar bar");
    expect(replaceAll("football foosball fool", "foo", "bar")).toBe("bartball barsball barl");
  });
});

describe("safeJsonParse", () => {
  it("should return parsed result with valid JSON", () => {
    const obj = { prop: "value" };
    expect(safeJsonParse(JSON.stringify(obj))).toEqual(obj);
  })
  it("should return undefined for invalid JSON", () => {
    expect(safeJsonParse()).toBeUndefined();
    expect(safeJsonParse("{")).toBeUndefined();
  })
});

describe("buildFirebaseImageUrl", () => {
  it("should work as expected", () => {
    expect(buildFirebaseImageUrl("class-hash", "image-key")).toBe("ccimg://fbrtdb.concord.org/class-hash/image-key")
  });
});

describe("parseFirebaseImageUrl", () => {
  it("should work as expected", () => {
    expect(parseFirebaseImageUrl("https://concord.org/image.png"))
      .toEqual({ legacyUrl: "https://concord.org/image.png" });
    expect(parseFirebaseImageUrl("ccimg://fbrtdb.concord.org/image-key"))
      .toEqual({ imageKey: "image-key", legacyUrl: "ccimg://fbrtdb.concord.org/image-key" });
    expect(parseFirebaseImageUrl("ccimg://fbrtdb.concord.org/class-hash/image-key"))
      .toEqual({ imageClassHash: "class-hash", imageKey: "image-key", legacyUrl: "ccimg://fbrtdb.concord.org/image-key" });
  });
});
