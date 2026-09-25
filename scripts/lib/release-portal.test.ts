import { releaseBranch, releasePaths, retargetText, retargetUrl } from "./release-portal";

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
