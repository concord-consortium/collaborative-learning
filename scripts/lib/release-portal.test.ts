import { isMoveBackward, isReleaseUrl, releaseBranch, releasePaths, retargetText, retargetUrl } from "./release-portal";

const kBase = "https://collaborative-learning.concord.org";

describe("releaseBranch", () => {
  it("names the release branch of a tag", () => {
    expect(releaseBranch("v7.6.0")).toBe("v7.6.x");
    expect(releaseBranch("v10.12.3")).toBe("v10.12.x");
  });
  it("rejects anything that isn't a release tag", () => {
    expect(() => releaseBranch("7.6.0")).toThrow("not a release tag");
    expect(() => releaseBranch("v7.6")).toThrow("not a release tag");
  });
});

describe("releasePaths", () => {
  it("lists the version and release-branch folders", () => {
    expect(releasePaths("v7.6.0")).toEqual(["version/v7.6.0/", "branch/v7.6.x/"]);
  });
});

describe("retargetUrl", () => {
  it("moves a version URL to the new tag", () => {
    expect(retargetUrl(`${kBase}/version/v7.5.0/`, "v7.6.0")).toBe(`${kBase}/version/v7.6.0/`);
  });
  it("keeps the query", () => {
    expect(retargetUrl(`${kBase}/version/v7.5.0/?firebaseEnv=staging`, "v7.6.0"))
      .toBe(`${kBase}/version/v7.6.0/?firebaseEnv=staging`);
  });
  it("moves a release-branch URL to the new branch", () => {
    expect(retargetUrl(`${kBase}/branch/v7.5.x/?firebaseEnv=staging`, "v7.6.0"))
      .toBe(`${kBase}/branch/v7.6.x/?firebaseEnv=staging`);
  });
  it("leaves other URLs alone", () => {
    expect(retargetUrl(`${kBase}/branch/master/`, "v7.6.0")).toBe(`${kBase}/branch/master/`);
    expect(retargetUrl(`${kBase}/`, "v7.6.0")).toBe(`${kBase}/`);
  });
});

describe("retargetText", () => {
  it("replaces version and release-branch names", () => {
    expect(retargetText("CLUE Teacher Tools (v7.5.0, staging FB)", "v7.6.0"))
      .toBe("CLUE Teacher Tools (v7.6.0, staging FB)");
    expect(retargetText("CLUE Teacher Tools (v7.5.x branch, staging FB)", "v7.6.0"))
      .toBe("CLUE Teacher Tools (v7.6.x branch, staging FB)");
  });
  it("leaves text without a version alone", () => {
    expect(retargetText("CLUE (test)", "v7.6.0")).toBe("CLUE (test)");
  });
});

describe("isReleaseUrl", () => {
  it("accepts a version or release-branch URL on the CLUE site", () => {
    expect(isReleaseUrl(`${kBase}/version/v7.5.0/?firebaseEnv=staging`, kBase)).toBe(true);
    expect(isReleaseUrl(`${kBase}/branch/v7.5.x/`, kBase)).toBe(true);
  });
  it("rejects a release path on another site", () => {
    expect(isReleaseUrl("https://activity-player.concord.org/version/v7.5.0/", kBase)).toBe(false);
    expect(isReleaseUrl(`${kBase}.example.com/version/v7.5.0/`, kBase)).toBe(false);
  });
  it("rejects a path that names no complete release", () => {
    expect(isReleaseUrl(`${kBase}/branch/v7-feature/`, kBase)).toBe(false);
    expect(isReleaseUrl(`${kBase}/version/v7.5/`, kBase)).toBe(false);
    expect(isReleaseUrl(`${kBase}/branch/master/`, kBase)).toBe(false);
  });
});

describe("isMoveBackward", () => {
  it("is true only when the record points at a newer release than the tag", () => {
    expect(isMoveBackward(`${kBase}/version/v7.6.0/`, "v7.5.0")).toBe(true);
    expect(isMoveBackward(`${kBase}/version/v7.6.1/?firebaseEnv=staging`, "v7.6.0")).toBe(true);
    expect(isMoveBackward(`${kBase}/version/v7.5.0/`, "v7.6.0")).toBe(false);
    expect(isMoveBackward(`${kBase}/version/v7.6.0/`, "v7.6.0")).toBe(false);
    expect(isMoveBackward(`${kBase}/version/v7.10.0/`, "v7.9.0")).toBe(true);
  });
  it("compares a release branch on its major and minor version", () => {
    expect(isMoveBackward(`${kBase}/branch/v7.6.x/`, "v7.5.3")).toBe(true);
    expect(isMoveBackward(`${kBase}/branch/v7.6.x/`, "v7.6.0")).toBe(false);
    expect(isMoveBackward(`${kBase}/branch/v7.5.x/`, "v7.6.0")).toBe(false);
  });
});
