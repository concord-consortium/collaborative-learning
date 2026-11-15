import { CountedSet } from "./counted-set";

describe("CountedSet", () => {
  it("keeps an item until it has been deleted as many times as it was added", () => {
    const set = new CountedSet<string>();
    set.add("a");
    set.add("a");
    expect(set.delete("a")).toBe(true);
    expect(set.has("a")).toBe(true);
    expect(set.delete("a")).toBe(true);
    expect(set.has("a")).toBe(false);
  });

  it("counts each item separately", () => {
    const set = new CountedSet<string>();
    set.add("a");
    set.add("b");
    set.delete("a");
    expect(set.has("a")).toBe(false);
    expect(set.has("b")).toBe(true);
  });

  it("returns false when deleting an item it doesn't have, and doesn't count below zero", () => {
    const set = new CountedSet<string>();
    expect(set.delete("a")).toBe(false);
    // The failed delete leaves nothing behind: one add puts the item in, and one delete takes it out.
    set.add("a");
    expect(set.has("a")).toBe(true);
    set.delete("a");
    expect(set.has("a")).toBe(false);
  });
});
