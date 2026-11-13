import fs from "fs";
import path from "path";

const kRoot = path.resolve(__dirname, "../..");
const kWorkflows = path.join(kRoot, ".github/workflows");

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

const carriedForwardFlags = () => {
  const text = fs.readFileSync(path.join(kRoot, "codecov.yml"), "utf8");
  const matches = [...text.matchAll(/- name: (\S+)\s+carryforward: true/g)];
  // Codecov also reads carryforward from `default_rules` and a top-level `flags:` key; fail rather than miss one.
  expect(text.split("carryforward:").length - 1).toBe(matches.length);
  return new Set(matches.map(m => m[1]));
};

describe("codecov.yml", () => {
  it("carries forward every uploaded flag except jest, and nothing else", () => {
    const uploaded = uploadedFlags();
    const expected = [...uploaded].filter(f => f !== "jest").sort();
    expect([...carriedForwardFlags()].sort()).toEqual(expected);
  });
});
