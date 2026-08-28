import fs from "node:fs";
import path from "node:path";
import {
  buildImageMessages, buildSummaryMessages, buildZodResponseSchema, categorizationResponseFormat, defaultAiPrompt
} from "../../../shared/ai-analysis-messages.js";
import { repoRoot } from "./helpers.js";

const kForbidden = [/^firebase-functions/, /^firebase-admin/, /^@google-cloud\//, /^firebase$/];

/**
 * Walks the module graph out from an entry file, following relative imports and collecting the bare
 * specifiers it reaches. Jest gives no access to its ESM registry, so the "no Firebase in this graph"
 * assertion is made statically — which also catches a Firebase import added to a transitive
 * dependency, not only one that happens to execute.
 */
/**
 * Removes line and block comments so a commented-out import is not mistaken for a real one. Without
 * this, a note like `// we must never import firebase-admin here` fails the check as a false positive.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function bareImportsReachableFrom(entry: string): Set<string> {
  const bare = new Set<string>();
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = stripComments(fs.readFileSync(file, "utf8"));
    const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1]);
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) {
        bare.add(specifier);
        continue;
      }
      const base = path.resolve(path.dirname(file), specifier.replace(/\.js$/, ""));
      const candidate = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]
        .find((option) => fs.existsSync(option) && fs.statSync(option).isFile());
      if (candidate) queue.push(candidate);
    }
  }
  return bare;
}

/**
 * This is a load-and-run check across the package boundary, not a specification of what the builders
 * produce — that lives next to the code, in shared/ai-analysis-messages.test.ts. What is being proved
 * here is that the module resolves and executes from this package's dependency tree, and that pulling
 * it in drags no Firebase along with it.
 */
describe("the shared message builders load and run from the harness", () => {
  const aiPrompt = defaultAiPrompt;

  it("builds a response schema", () => {
    expect(Object.keys(buildZodResponseSchema(aiPrompt)).sort())
      .toEqual(["category", "discussion", "keyIndicators"]);
  });

  it("builds a response format", () => {
    const responseFormat = categorizationResponseFormat(buildZodResponseSchema(aiPrompt)) as any;
    expect(responseFormat.type).toBe("json_schema");
    expect(responseFormat.json_schema.name).toBe("categorization-response");
  });

  it("builds image messages", () => {
    const messages = buildImageMessages(aiPrompt, "https://example.com/doc.png");
    expect(messages).toHaveLength(2);
    expect((messages[1].content as any[])[1].type).toBe("image_url");
  });

  it("builds summary messages", () => {
    const messages = buildSummaryMessages(aiPrompt, "# CLUE Document Summary", []);
    expect((messages[1].content as any[])[1].text).toContain("# CLUE Document Summary");
  });

  it("pulls no Firebase or Firestore module into its graph", () => {
    const bare = bareImportsReachableFrom(path.join(repoRoot, "shared", "ai-analysis-messages.ts"));
    const forbidden = [...bare].filter((specifier) => kForbidden.some((pattern) => pattern.test(specifier)));
    expect(forbidden).toEqual([]);
    // Sanity check that the walk actually followed the imports, without pinning the complete list:
    // a legitimate new import in the shared module should not fail this suite.
    expect([...bare]).toEqual(expect.arrayContaining(["openai/helpers/zod", "zod"]));
  });
});
