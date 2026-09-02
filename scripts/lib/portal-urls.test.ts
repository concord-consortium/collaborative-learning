import { IUrlOptions, buildUrls, defaultName, describeCluePath, firebaseLabel } from "./portal-urls";

// These assertions are deliberately written as whole expected strings rather than as
// `toContain` checks on individual parameters. The portal matches these URLs by exact string
// equality — the activity by external_url, the report by its form field, the OAuth redirect
// URI inside a whitespace-separated list — so a reordered query or a differently escaped
// slash is a different URL to it, and would turn every idempotent reuse into a duplicate on
// a shared portal. Only a full-string comparison notices that.

const baseOptions: IUrlOptions = {
  clueBase: "https://collaborative-learning.concord.org",
  cluePath: "version/v7.5.0",
  unit: "seismic",
  problem: "1.1",
  firebaseEnv: "production"
};

describe("buildUrls", () => {
  it("builds the student, teacher and redirect URLs for a production run", () => {
    expect(buildUrls(baseOptions)).toEqual({
      activity: "https://collaborative-learning.concord.org/version/v7.5.0/?unit=seismic&problem=1.1",
      // No query at all: production is CLUE's default Firebase project, and the portal
      // appends the report's own parameters to whatever is here.
      report: "https://collaborative-learning.concord.org/version/v7.5.0/",
      // No query and a trailing slash: this is origin + pathname, which is what CLUE sends
      // as its OAuth redirect_uri and what the portal compares character for character.
      redirect: "https://collaborative-learning.concord.org/version/v7.5.0/"
    });
  });

  it("names a non-default Firebase project on both launch URLs", () => {
    // The report URL needs its own firebaseEnv or the teacher's CLUE reaches a different
    // Firebase project than the students' and shows an empty report.
    expect(buildUrls({ ...baseOptions, firebaseEnv: "staging" })).toEqual({
      activity:
        "https://collaborative-learning.concord.org/version/v7.5.0/" +
        "?unit=seismic&problem=1.1&firebaseEnv=staging",
      report: "https://collaborative-learning.concord.org/version/v7.5.0/?firebaseEnv=staging",
      // The redirect URI never carries a query, so it is the same for either project.
      redirect: "https://collaborative-learning.concord.org/version/v7.5.0/"
    });
  });

  it("leaves the slashes of a demo unit path unescaped", () => {
    // %2F would be equally valid to a browser and NOT equal to the URL a person pastes into
    // the portal by hand, which is the comparison that decides create-vs-reuse.
    expect(buildUrls({ ...baseOptions, unit: "./demo/units/qa/content.json" }).activity).toBe(
      "https://collaborative-learning.concord.org/version/v7.5.0/" +
      "?unit=./demo/units/qa/content.json&problem=1.1"
    );
  });

  it("builds branch URLs from the deployed path", () => {
    expect(buildUrls({ ...baseOptions, cluePath: "branch/portal-assignment-setup" }).redirect).toBe(
      "https://collaborative-learning.concord.org/branch/portal-assignment-setup/"
    );
  });

  it("honours an alternate deployment root", () => {
    expect(buildUrls({ ...baseOptions, clueBase: "http://localhost:8080" }).redirect).toBe(
      "http://localhost:8080/version/v7.5.0/"
    );
  });
});

describe("describeCluePath", () => {
  it("labels a branch as one, and a version by its tag alone", () => {
    expect(describeCluePath("branch/my-feature")).toBe("my-feature branch");
    expect(describeCluePath("version/v7.5.0")).toBe("v7.5.0");
  });
});

describe("firebaseLabel", () => {
  it("names only a non-default project", () => {
    expect(firebaseLabel("production")).toBe("");
    expect(firebaseLabel("staging")).toBe(", staging FB");
  });
});

describe("defaultName", () => {
  it("names a version resource after its unit, problem and tag", () => {
    expect(defaultName(baseOptions)).toBe("CLUE seismic 1.1 (v7.5.0)");
  });

  it("names a branch resource and a non-default Firebase project", () => {
    expect(defaultName({ ...baseOptions, cluePath: "branch/my-feature", firebaseEnv: "staging" }))
      .toBe("CLUE seismic 1.1 (my-feature branch, staging FB)");
  });

  it("uses a demo unit's directory rather than its whole path", () => {
    expect(defaultName({ ...baseOptions, unit: "./demo/units/qa/content.json" }))
      .toBe("CLUE qa 1.1 (v7.5.0)");
  });
});
