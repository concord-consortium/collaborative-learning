// Builds spikerbit-clue.hex from spikerbit-clue.ts with the MakeCode toolchain pinned in
// package.json. It also writes the generated parts of user-guide.md and the board pictures in
// guide-images/, from the tagged comments in spikerbit-clue.ts and MakeCode's icon definitions.
//   npx tsx build.ts          rebuild and overwrite the committed hex, guide sections and pictures
//   npx tsx build.ts --check  rebuild and fail if the result differs from any of them
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderBoardSvg } from "./board-svg";
import {
  collectGuideTags, displayImageName, iconPatterns, kGuideImageDir, renderGuideSections,
  replaceGuideSections
} from "./guide";

const toolDir = __dirname;
const repoRoot = path.resolve(toolDir, "../..");
const firmwareDir = path.join(repoRoot, "src/plugins/dataflow/firmware");
const sourcePath = path.join(firmwareDir, "spikerbit-clue.ts");
const hexPath = path.join(firmwareDir, "spikerbit-clue.hex");
const guidePath = path.join(firmwareDir, "user-guide.md");
const guideImageDir = path.join(firmwareDir, kGuideImageDir);
const pxtRunner = path.join(toolDir, "pxt.cjs");

function buildHex(): Buffer {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "spikerbit-firmware-"));
  try {
    // The hex embeds every project file, so the project holds only main.ts and pxt.json.
    fs.copyFileSync(path.join(toolDir, "project/pxt.json"), path.join(projectDir, "pxt.json"));
    fs.copyFileSync(sourcePath, path.join(projectDir, "main.ts"));
    // pxt runs in its own process: it works on the current directory, and on a failed build
    // it exits the process itself.
    const result = spawnSync(process.execPath, [pxtRunner, "build", "--install"],
      { cwd: projectDir, stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`pxt build failed (${result.status ?? result.signal})`);
    }
    // binary.hex is the universal (V1+V2) hex; mbdal-/mbcodal-binary.hex are the per-board halves.
    return fs.readFileSync(path.join(projectDir, "built/binary.hex"));
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

// Returns a Map of every generated guide file's absolute path to its content: the guide with
// its generated sections filled in, and one board picture per display.
function generateGuide(): Map<string, string> {
  const tags = collectGuideTags(fs.readFileSync(sourcePath, "utf8"));
  const guide = replaceGuideSections(fs.readFileSync(guidePath, "utf8"), renderGuideSections(tags));
  const target = JSON.parse(
    fs.readFileSync(path.join(toolDir, "node_modules/pxt-microbit/built/target.json"), "utf8"));
  const patterns = iconPatterns(target.bundledpkgs.core["icons.ts"]);
  const files = new Map([[guidePath, guide]]);
  for (const display of tags.displays) {
    const pattern = patterns[display.icon];
    if (!pattern) {
      throw new Error(`IconNames.${display.icon} for "${display.title}" isn't defined by MakeCode`);
    }
    const svg = renderBoardSvg(pattern);
    if (renderBoardSvg(pattern) !== svg) {
      throw new Error("MicrobitBoardSvg output is not deterministic");
    }
    files.set(path.join(guideImageDir, displayImageName(display)), svg);
  }
  return files;
}

function listGuideImages(): string[] {
  return fs.existsSync(guideImageDir)
    ? fs.readdirSync(guideImageDir).filter(name => !name.startsWith(".")).map(name => path.join(guideImageDir, name))
    : [];
}

const check = process.argv.includes("--check");
const hexName = path.relative(repoRoot, hexPath);
let built: Buffer;
let guideFiles: Map<string, string>;
try {
  built = buildHex();
  guideFiles = generateGuide();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

const relative = (file: string) => path.relative(repoRoot, file);

if (check) {
  const mismatches: string[] = [];
  if (!built.equals(fs.readFileSync(hexPath))) {
    mismatches.push(`${hexName} is not the build of spikerbit-clue.ts.`);
  }
  for (const [file, content] of guideFiles) {
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
      mismatches.push(`${relative(file)} is not what spikerbit-clue.ts generates.`);
    }
  }
  for (const file of listGuideImages()) {
    if (!guideFiles.has(file)) mismatches.push(`${relative(file)} is not generated from spikerbit-clue.ts.`);
  }
  if (mismatches.length) {
    mismatches.forEach(message => console.error(`${message} Run \`npm run build:firmware\` and commit the result.`));
    process.exit(1);
  }
  console.log(`${hexName} and the guide match the build of spikerbit-clue.ts.`);
} else {
  fs.writeFileSync(hexPath, built);
  console.log(`Wrote ${hexName}.`);
  fs.mkdirSync(guideImageDir, { recursive: true });
  for (const file of listGuideImages()) {
    if (!guideFiles.has(file)) fs.rmSync(file);
  }
  for (const [file, content] of guideFiles) {
    fs.writeFileSync(file, content);
    console.log(`Wrote ${relative(file)}.`);
  }
}
