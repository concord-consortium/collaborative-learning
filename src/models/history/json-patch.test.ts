import { IJsonPatch } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { applyJsonPatches, diffJson, JsonPatchError } from "./json-patch";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("applyJsonPatches", () => {
  it("applies add, replace and remove on objects and arrays", () => {
    const doc = { a: { b: 1 }, list: [1, 2] };
    applyJsonPatches(doc, [
      { op: "replace", path: "/a/b", value: 2 },
      { op: "add", path: "/list/1", value: 9 },
      { op: "add", path: "/list/-", value: 7 },
      { op: "remove", path: "/list/0" }
    ]);
    expect(doc).toEqual({ a: { b: 2 }, list: [9, 2, 7] });
  });

  it("sets a missing object member on replace and deletes it on an undefined value", () => {
    const doc: any = { a: { b: 1 } };
    applyJsonPatches(doc, [{ op: "replace", path: "/a/c", value: 3 }]);
    expect(doc.a.c).toBe(3);
    applyJsonPatches(doc, [{ op: "replace", path: "/a/c" } as IJsonPatch]);
    expect("c" in doc.a).toBe(false);
  });

  it("treats removing a missing object member as a no-op", () => {
    const doc = { a: { b: 1 } };
    applyJsonPatches(doc, [{ op: "remove", path: "/a/zzz" }]);
    expect(doc).toEqual({ a: { b: 1 } });
  });

  it("throws JsonPatchError with the failed index when a parent does not resolve", () => {
    const doc = { a: { b: 1 } };
    let error: unknown;
    try {
      applyJsonPatches(doc, [
        { op: "replace", path: "/a/b", value: 5 },
        { op: "replace", path: "/missing/x", value: 1 }
      ]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(JsonPatchError);
    expect((error as JsonPatchError).failedIndex).toBe(1);
    expect(doc).toEqual({ a: { b: 1 } });
  });

  it("undoes the patches before a failing one, from the values they replaced", () => {
    const item = { v: 1 };
    const doc: any = { a: { b: 1 }, l: [item, { v: 2 }], m: { gone: 1 } };
    const before = cloneDeep(doc);
    // The patches don't come with inverses, and these are ones that a forward list's opposite
    // wouldn't undo in reverse order.
    expect(() => applyJsonPatches(doc, [
      { op: "replace", path: "/a/b", value: 5 },
      { op: "add", path: "/a/c", value: 6 },
      { op: "remove", path: "/m/gone" },
      { op: "add", path: "/l/0", value: { v: 0 } },
      { op: "replace", path: "/l/1/v", value: 9 },
      { op: "replace", path: "/l/2", value: { v: 3 } },
      { op: "remove", path: "/l/0" },
      { op: "replace", path: "/a", value: { replaced: true } },
      { op: "replace", path: "/missing/x", value: 1 }
    ])).toThrow(JsonPatchError);
    expect(doc).toEqual(before);
    expect(doc.l[0]).toBe(item);
  });

  it("throws on an empty path", () => {
    let error: unknown;
    try {
      applyJsonPatches({}, [{ op: "replace", path: "", value: 1 }]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(JsonPatchError);
    expect((error as JsonPatchError).failedIndex).toBe(0);
  });

  it("throws on a path that doesn't start with /, and leaves the document alone", () => {
    const doc: any = { a: { b: 1 }, b: 1 };
    expect(() => applyJsonPatches(doc, [{ op: "add", path: "foo", value: 1 }])).toThrow(JsonPatchError);
    expect(() => applyJsonPatches(doc, [{ op: "remove", path: "foo" }])).toThrow(JsonPatchError);
    expect(() => applyJsonPatches(doc, [{ op: "replace", path: "a/b", value: 2 }])).toThrow(JsonPatchError);
    expect(doc).toEqual({ a: { b: 1 }, b: 1 });
  });

  it("throws on out of range array indexes", () => {
    expect(() => applyJsonPatches({ l: [1] }, [{ op: "add", path: "/l/5", value: 1 }])).toThrow(JsonPatchError);
    expect(() => applyJsonPatches({ l: [1] }, [{ op: "replace", path: "/l/1", value: 1 }])).toThrow(JsonPatchError);
    expect(() => applyJsonPatches({ l: [1] }, [{ op: "remove", path: "/l/1" }])).toThrow(JsonPatchError);
  });

  it("add accepts the length as an index and rejects anything past it or non-numeric", () => {
    const doc: any = { l: [1] };
    applyJsonPatches(doc, [{ op: "add", path: "/l/1", value: 2 }]);
    expect(doc.l).toEqual([1, 2]);
    expect(() => applyJsonPatches({ l: [1] }, [{ op: "add", path: "/l/2", value: 1 }])).toThrow(JsonPatchError);
    expect(() => applyJsonPatches({ l: [1] }, [{ op: "add", path: "/l/x", value: 1 }])).toThrow(JsonPatchError);
  });

  it("throws when the parent is a primitive", () => {
    expect(() => applyJsonPatches({ a: 1 }, [{ op: "remove", path: "/a/b" }])).toThrow(JsonPatchError);
  });

  it("unescapes ~1 and ~0 in path segments", () => {
    const doc: any = { m: {} };
    applyJsonPatches(doc, [{ op: "add", path: "/m/a~1b~0c", value: 1 }]);
    expect(doc.m["a/b~c"]).toBe(1);
  });

  it("unescapes ~1 before ~0, so ~01 is ~1", () => {
    const doc: any = { m: {} };
    applyJsonPatches(doc, [{ op: "add", path: "/m/a~01", value: 1 }]);
    expect(doc.m).toEqual({ "a~1": 1 });
  });

  it("never reaches objects outside the document through inherited properties", () => {
    const paths = ["/__proto__/polluted", "/constructor/prototype/polluted", "/a/__proto__"];
    paths.forEach(path => {
      const doc: any = { a: {} };
      expect(() => applyJsonPatches(doc, [{ op: "add", path, value: { polluted: 1 } }]))
        .toThrow(JsonPatchError);
      expect(({} as any).polluted).toBeUndefined();
      expect(Object.getPrototypeOf(doc.a)).toBe(Object.prototype);
    });
  });

  it("does not share inserted values with the frozen patch", () => {
    const doc: any = { a: {} };
    const patch: IJsonPatch = deepFreeze({ op: "add", path: "/a/x", value: { n: { m: 1 } } });
    applyJsonPatches(doc, [patch]);
    expect(() => { doc.a.x.n.m = 2; }).not.toThrow();
    expect(patch.value.n.m).toBe(1);
  });
});

describe("diffJson", () => {
  it("round-trips", () => {
    const before = { "x": 1, "list": [{ id: "a" }], "k/1": 2 };
    const after = { x: 2, list: [{ id: "b" }, { id: "c" }] };

    const forward: any = { t: JSON.parse(JSON.stringify(before)) };
    applyJsonPatches(forward, diffJson(before, after, "/t"));
    expect(forward).toEqual({ t: after });

    const backward: any = { t: JSON.parse(JSON.stringify(after)) };
    applyJsonPatches(backward, diffJson(after, before, "/t"));
    expect(backward).toEqual({ t: before });
  });

  it("names the path and the missing side when one side is undefined", () => {
    expect(() => diffJson(undefined, { a: 1 }, "/content/tileMap/t1"))
      .toThrow("diffJson at /content/tileMap/t1: before is undefined");
    expect(() => diffJson({ a: 1 }, undefined, "/content/tileMap/t1"))
      .toThrow("diffJson at /content/tileMap/t1: after is undefined");
  });
});
