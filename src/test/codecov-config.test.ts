import fs from "fs";
import path from "path";

const kRoot = path.resolve(__dirname, "../..");
const kWorkflows = path.join(kRoot, ".github/workflows");
const read = (file: string) => fs.readFileSync(path.join(kRoot, file), "utf8");

const capture = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  expect(match).not.toBeNull();
  return match?.[1] ?? "";
};
const list = (text: string) => text.split(",").map(item => item.trim().replace(/^"|"$/g, ""));

const kCodecov = read("codecov.yml");

const uploadedFlags = () => {
  const flags = new Set<string>();
  for (const file of fs.readdirSync(kWorkflows).filter(f => /\.ya?ml$/.test(f))) {
    const text = fs.readFileSync(path.join(kWorkflows, file), "utf8");
    const uploads = text.split("uses: codecov/codecov-action@").length - 1;
    const matches = [...text.matchAll(/uses: codecov\/codecov-action@\S+\s+with:\s+flags: (\S+)/g)];
    // The regex needs `flags:` as the first key under `with:`; fail rather than skip an upload it cannot read.
    expect({ file, uploads: matches.length }).toEqual({ file, uploads });
    matches.forEach(m => flags.add(m[1]));
  }
  return flags;
};

describe("codecov.yml", () => {
  it("waits for one cypress-regression upload per CI Regression container", () => {
    const containers = list(capture(read(".github/workflows/ci-regression.yml"), /^\s+container: \[(.*)\]/m));
    const builds = Number(capture(kCodecov, /name: cypress-regression\s+after_n_builds: (\d+)/));
    expect(builds).toBe(containers.length);
  });

  it("has the label check guard the client paths and the Cypress specs, and only paths that exist", () => {
    const clientPaths = list(capture(kCodecov, /paths: &client_paths \[(.*)\]/));
    const labelPaths = capture(read(".github/workflows/regression-label-check.yml"), /LABEL_PATHS: "(.*)"/).split(" ");
    expect(labelPaths).toEqual(expect.arrayContaining([...clientPaths, "cypress/"]));
    expect(labelPaths.filter(p => !fs.existsSync(path.join(kRoot, p)))).toEqual([]);
  });

  it("names only flags that a workflow uploads, leaving out the nightly cypress flag", () => {
    const statusFlags = [/flags: &client_flags \[(.*)\]/, /flags: &scripts_flags \[(.*)\]/]
      .flatMap(pattern => list(capture(kCodecov, pattern)));
    expect([...uploadedFlags()]).toEqual(expect.arrayContaining(statusFlags));
    expect(statusFlags).not.toContain("cypress");
  });
});
