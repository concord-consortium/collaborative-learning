import fs from "node:fs";
import path from "node:path";
import { kTemporaryFilePattern, writeFileAtomically, writeJsonFile } from "../src/files.js";
import { makeTestDataRoot } from "./helpers.js";

const dataRoot = makeTestDataRoot("files");

/** Everything in `directory`, sorted, so an assertion can name the whole list rather than filter it. */
const listing = (directory: string) => fs.readdirSync(directory).sort();

describe("writing a file atomically", () => {
  it("writes through a temporary file and leaves only the real one", () => {
    const file = path.join(dataRoot, "plain", "value.json");
    writeJsonFile(file, { a: 1 });
    expect(listing(path.dirname(file))).toEqual(["value.json"]);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ a: 1 });
  });

  it("leaves the previous file intact when the write fails", () => {
    // The guarantee is that a crash mid-write leaves either the previous file or none, never a
    // partial one. Only the successful path was covered, so neither the `rmSync` cleanup nor the
    // guarantee itself was ever checked.
    const file = path.join(dataRoot, "failing", "value.json");
    writeFileAtomically(file, "the previous contents");

    // Patched directly rather than through a mocking helper: `files.ts` calls `fs.writeFileSync`
    // as a property of the same imported object, so replacing the property is enough.
    const realWriteFileSync = fs.writeFileSync;
    fs.writeFileSync = ((target: fs.PathOrFileDescriptor, contents: string | Buffer) => {
      if (String(target).endsWith(".tmp")) throw new Error("ENOSPC: no space left on device");
      return realWriteFileSync(target, contents);
    }) as typeof fs.writeFileSync;
    try {
      expect(() => writeFileAtomically(file, "the new contents"))
        .toThrow(/ENOSPC: no space left on device/);
    } finally {
      fs.writeFileSync = realWriteFileSync;
    }

    // The failure is rethrown, the previous file still reads, and no temporary file is left behind.
    expect(fs.readFileSync(file, "utf8")).toBe("the previous contents");
    expect(listing(path.dirname(file))).toEqual(["value.json"]);
  });

  it("gives every write its own temporary name", () => {
    // A name built from the process id alone is not unique within that process: two concurrent
    // writes to one path would share it, and each would rename the other's half-written bytes into
    // place.
    const file = path.join(dataRoot, "unique", "value.json");
    const names: string[] = [];
    const realWriteFileSync = fs.writeFileSync;
    fs.writeFileSync = ((target: fs.PathOrFileDescriptor, contents: string | Buffer) => {
      names.push(path.basename(String(target)));
      return realWriteFileSync(target, contents);
    }) as typeof fs.writeFileSync;
    try {
      writeFileAtomically(file, "one");
      writeFileAtomically(file, "two");
    } finally {
      fs.writeFileSync = realWriteFileSync;
    }
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    // And each one is a name the prune sweeps recognise, so a leftover cannot become invisible.
    for (const name of names) {
      expect({ name, matches: new RegExp(`^value\\.json${kTemporaryFilePattern}$`).test(name) })
        .toEqual({ name, matches: true });
    }
  });
});
