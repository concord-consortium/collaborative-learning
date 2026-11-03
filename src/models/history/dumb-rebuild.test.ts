import fs from "fs";
import path from "path";
import { applyPatch, Operation } from "fast-json-patch";

// A service that knows nothing about CLUE rebuilds a document from its stored history entries
// with a plain JSON patch library. The conversion entry is applied like any other entry.

interface IStoredRecord {
  patches: Operation[];
  inversePatches: Operation[];
}
interface IStoredEntry {
  isConversion?: boolean;
  records: IStoredRecord[];
}
interface IFixture {
  endDocument: any;
  entries: IStoredEntry[];
}

const fixture: IFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "conversion-chain.json"), "utf8"));

const clone = (value: any) => JSON.parse(JSON.stringify(value));

function undoEntry(doc: any, entry: IStoredEntry) {
  [...entry.records].reverse().forEach(record => {
    applyPatch(doc, clone([...record.inversePatches].reverse()), false, true);
  });
}

function redoEntry(doc: any, entry: IStoredEntry) {
  entry.records.forEach(record => {
    applyPatch(doc, clone(record.patches), false, true);
  });
}

const t1Version = (doc: any) => doc.content.tileMap.t1.content.version;

describe("dumb rebuild", () => {
  it("rebuilds every position with a plain JSON patch library", () => {
    const { endDocument, entries } = fixture;
    const conversionIndex = entries.findIndex(entry => entry.isConversion);
    expect(conversionIndex).toBeGreaterThanOrEqual(0);

    // versions[i] is t1's version at position i
    const doc = clone(endDocument);
    const versions: (string | undefined)[] = [t1Version(doc)];
    for (let i = entries.length - 1; i >= 0; i--) {
      undoEntry(doc, entries[i]);
      versions.unshift(t1Version(doc));
    }
    expect(t1Version(doc)).toBeUndefined();
    expect(doc.content.tileMap.t1.content.text).toBe("a");

    entries.forEach(entry => redoEntry(doc, entry));
    expect(doc).toEqual(endDocument);

    expect(versions[conversionIndex]).toBeUndefined();
    expect(versions[conversionIndex + 1]).toBe("2");
  });
});
