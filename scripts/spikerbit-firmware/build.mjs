// Builds spikerbit-clue.hex from spikerbit-clue.ts with the MakeCode toolchain pinned in
// package.json.
//   node build.mjs          rebuild and overwrite the committed hex
//   node build.mjs --check  rebuild and fail if the result differs from the committed hex
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../..");
const firmwareDir = path.join(repoRoot, "src/plugins/dataflow/firmware");
const sourcePath = path.join(firmwareDir, "spikerbit-clue.ts");
const hexPath = path.join(firmwareDir, "spikerbit-clue.hex");
const pxtRunner = path.join(toolDir, "pxt.cjs");

function buildHex() {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "spikerbit-firmware-"));
  try {
    // A hex embeds every file in its MakeCode project, so the project is just main.ts and
    // pxt.json; importing the hex into the MakeCode editor opens main.ts in JavaScript.
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

const check = process.argv.includes("--check");
const hexName = path.relative(repoRoot, hexPath);
let built;
try {
  built = buildHex();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if (check) {
  if (!built.equals(fs.readFileSync(hexPath))) {
    console.error(`${hexName} is not the build of spikerbit-clue.ts. `
      + "Run `npm run build:firmware` and commit the result.");
    process.exit(1);
  }
  console.log(`${hexName} matches the build of spikerbit-clue.ts.`);
} else {
  fs.writeFileSync(hexPath, built);
  console.log(`Wrote ${hexName}.`);
}
