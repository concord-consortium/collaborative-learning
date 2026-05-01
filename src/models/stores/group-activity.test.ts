import { GroupActivityModel } from "./group-activity";

describe("GroupActivityModel", () => {
  it("starts empty and returns no users for any tile", () => {
    const store = GroupActivityModel.create({});
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
  });

  it("setActivity adds an entry; usersFocusedOnTile filters by doc + tile + skippedUserId", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({
      userId: "u1", documentKey: "doc1",
      focus: { tileIds: ["tileA", "tileB"] },
      updatedAt: 1
    });
    store.setActivity({
      userId: "u2", documentKey: "doc1",
      focus: { tileIds: ["tileA"] },
      updatedAt: 2
    });
    store.setActivity({
      userId: "u3", documentKey: "doc2",
      focus: { tileIds: ["tileA"] },
      updatedAt: 3
    });

    expect(store.usersFocusedOnTile("doc1", "tileA").map(a => a.userId).sort()).toEqual(["u1", "u2"]);
    expect(store.usersFocusedOnTile("doc1", "tileA", "u1").map(a => a.userId).sort()).toEqual(["u2"]);
    expect(store.usersFocusedOnTile("doc1", "tileB").map(a => a.userId)).toEqual(["u1"]);
    expect(store.usersFocusedOnTile("doc2", "tileA").map(a => a.userId)).toEqual(["u3"]);
  });

  it("setActivity replaces existing entry for same user", () => {
    const store = GroupActivityModel.create({});

    store.setActivity({ userId: "u1", documentKey: "doc1", focus: { tileIds: ["tileA"] }, updatedAt: 1 });
    expect(store.usersFocusedOnTile("doc1", "tileA").map(a => a.userId)).toEqual(["u1"]);
    expect(store.usersFocusedOnTile("doc2", "tileB")).toEqual([]);

    store.setActivity({ userId: "u1", documentKey: "doc2", focus: { tileIds: ["tileB"] }, updatedAt: 2 });
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
    expect(store.usersFocusedOnTile("doc2", "tileB").map(a => a.userId)).toEqual(["u1"]);
  });

  it("removeActivity drops the user", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({ userId: "u1", documentKey: "doc1", focus: { tileIds: ["tileA"] }, updatedAt: 1 });
    expect(store.usersFocusedOnTile("doc1", "tileA").map(a => a.userId)).toEqual(["u1"]);
    store.removeActivity("u1");
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
  });

  it("ignores activity records with no focus", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({ userId: "u1", documentKey: "doc1", updatedAt: 1 });
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
  });

  it("clear removes all activities", () => {
    const store = GroupActivityModel.create({});
    store.setActivity({ userId: "u1", documentKey: "doc1", focus: { tileIds: ["tileA"] }, updatedAt: 1 });
    expect(store.usersFocusedOnTile("doc1", "tileA").map(a => a.userId)).toEqual(["u1"]);
    store.clear();
    expect(store.usersFocusedOnTile("doc1", "tileA")).toEqual([]);
  });
});
