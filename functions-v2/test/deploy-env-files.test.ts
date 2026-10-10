import * as fs from "fs";
import * as path from "path";
import {Expression, declaredParams} from "firebase-functions/params";

// The Firebase CLI reads every non-secret param from `.env.<projectId>` at deploy time. For a param
// a file leaves out, an interactive deploy asks for a value and writes the answer into the file,
// and a non-interactive deploy fails. These tests keep the committed files complete.
const projectFiles = [".env.collaborative-learning-staging", ".env.collaborative-learning-ec215"];

// Only bare KEY=VALUE lines, so this parser and the CLI's read the files the same way.
const kLine = /^([A-Z_][A-Z0-9_]*)=([^\s"'#]*)$/;

const readEnvFile = (name: string) => {
  const text = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
  const entries: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const match = kLine.exec(line);
    if (!match) throw new Error(`${name}: not a bare KEY=VALUE line: ${line}`);
    entries[match[1]] = match[2];
  }
  return entries;
};

describe("the per-project deploy env files", () => {
  let stringParams: string[];
  let secretParams: string[];

  beforeAll(async () => {
    // Each define* call adds its param to declaredParams, which is what the CLI builds its list from.
    await import("../src/index");
    // Every non-secret param extends Expression; SecretParam does not.
    const isSecret = (param: typeof declaredParams[number]) => !(param instanceof Expression);
    stringParams = declaredParams.filter((param) => !isSecret(param)).map((param) => param.name).sort();
    secretParams = declaredParams.filter(isSecret).map((param) => param.name);
  });

  it("finds the declared params to compare against", () => {
    expect(stringParams).toContain("OPENAI_MODEL");
    expect(secretParams).toContain("OPENAI_TUTOR_API_KEY");
  });

  it.each(projectFiles)("%s sets exactly the declared non-secret params", (name) => {
    expect(Object.keys(readEnvFile(name)).sort()).toEqual(stringParams);
  });

  it.each(projectFiles)("%s leaves prompt-text logging off", (name) => {
    expect(readEnvFile(name).AI_PROMPT_TEXT_LOGGING).toBe("off");
  });

  it(".env.example documents every declared non-secret param", () => {
    const example = Object.keys(readEnvFile(".env.example"));
    expect(stringParams.filter((param) => !example.includes(param))).toEqual([]);
  });
});
