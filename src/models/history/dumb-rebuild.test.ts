import fs from "fs";
import path from "path";
import { IStoredEntry, rebuildBackAndForth } from "./dumb-rebuild-test-utils";

// A service that knows nothing about CLUE rebuilds a document from its stored history entries
// with a plain JSON patch library. The conversion entry is applied like any other entry.

interface IFixture {
  endDocument: any;
  entries: IStoredEntry[];
}

const fixture: IFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "conversion-chain.json"), "utf8"));

const t1Version = (doc: any) => doc.content.tileMap.t1.content.version;

describe("dumb rebuild", () => {
  it("rebuilds every position with a plain JSON patch library", () => {
    const { endDocument, entries } = fixture;
    const conversionIndex = entries.findIndex(entry => entry.isConversion);
    expect(conversionIndex).toBeGreaterThanOrEqual(0);

    const { positions, end } = rebuildBackAndForth(endDocument, entries);
    expect(t1Version(positions[0])).toBeUndefined();
    expect(positions[0].content.tileMap.t1.content.text).toBe("a");
    expect(end).toEqual(endDocument);

    expect(t1Version(positions[conversionIndex])).toBeUndefined();
    expect(t1Version(positions[conversionIndex + 1])).toBe("2");
  });
});
