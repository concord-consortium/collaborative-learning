import { scopeKeyForPatchPath } from "./entry-scopes";

describe("scopeKeyForPatchPath", () => {
  it("returns tile:<id> for a patch targeting tile content", () => {
    expect(scopeKeyForPatchPath("/content/tileMap/tileA/content/value")).toBe("tile:tileA");
  });

  it("returns tile:<id> for a patch that adds or removes the whole tile entry", () => {
    expect(scopeKeyForPatchPath("/content/tileMap/tileA")).toBe("tile:tileA");
  });

  it("returns shared:<id> for a patch targeting shared model content", () => {
    expect(scopeKeyForPatchPath("/content/sharedModelMap/sm1/sharedModel/value")).toBe("shared:sm1");
  });

  it("returns shared:<id> for a patch that adds or removes the whole shared model entry", () => {
    expect(scopeKeyForPatchPath("/content/sharedModelMap/sm1")).toBe("shared:sm1");
  });

  it("returns doc for rowMap paths", () => {
    expect(scopeKeyForPatchPath("/content/rowMap/row1/tiles")).toBe("doc");
  });

  it("returns doc for rowOrder paths", () => {
    expect(scopeKeyForPatchPath("/content/rowOrder/0")).toBe("doc");
  });

  it("returns doc for paths outside /content", () => {
    expect(scopeKeyForPatchPath("/metadata/title")).toBe("doc");
  });

  it("returns doc for the root path", () => {
    expect(scopeKeyForPatchPath("")).toBe("doc");
    expect(scopeKeyForPatchPath("/")).toBe("doc");
  });

  it("returns doc for /content paths that don't match tileMap or sharedModelMap", () => {
    expect(scopeKeyForPatchPath("/content/name")).toBe("doc");
  });

  it("handles tile ids that contain dashes, letters, and numbers", () => {
    expect(scopeKeyForPatchPath("/content/tileMap/ABC-123_xyz/content")).toBe("tile:ABC-123_xyz");
  });
});
