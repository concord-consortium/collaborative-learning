import fs from "fs";
import path from "path";
import { ccChecksum } from "./cc-device-protocol";
import {
  collectGuideTags, displayImageName, iconPatterns, readGuideSections, renderGuideSections,
  replaceGuideSections
} from "../../../scripts/spikerbit-firmware/guide";

const kStart = (name: string) => `<!-- generated: ${name} -->`;
const kEnd = (name: string) => `<!-- end generated: ${name} -->`;
const kNote = "<!-- Generated from spikerbit-clue.ts by npm run build:firmware. " +
  "Edit the comments there, not this section. -->";

const kSource = `
/**
 * @guide
 * How long the icon
 * shows.
 */
const ICON_MS = 3000
/**
 * @display Found
 * Shown after a ping.
 * A second line.
 *
 * Not for the guide.
 */
const FOUND_ICON = IconNames.Surprised
function f(icon: IconNames) {}
`;

describe("collectGuideTags", () => {
  it("collects displays and values in source order", () => {
    const { displays, values } = collectGuideTags(kSource);
    expect(displays).toEqual([{
      title: "Found", constName: "FOUND_ICON", icon: "Surprised",
      description: "Shown after a ping. A second line."
    }]);
    expect(values).toEqual([{ constName: "ICON_MS", value: 3000, description: "How long the icon shows." }]);
  });

  it("ignores the second paragraph of a @guide comment", () => {
    const { values } = collectGuideTags("/**\n * @guide\n * First.\n *\n * Second.\n */\nconst A_MS = 1");
    expect(values[0].description).toBe("First.");
  });

  it("throws naming a display whose initializer isn't an IconNames member", () => {
    expect(() => collectGuideTags("/** @display Bad\n * x */ const BAD_ICON = 5")).toThrow("BAD_ICON");
  });

  it("throws naming a guide constant that isn't a number", () => {
    expect(() => collectGuideTags("/**\n * @guide\n * x\n */\nconst BAD_VALUE = \"a\"")).toThrow("BAD_VALUE");
  });

  it("throws naming a tagged constant with no description", () => {
    expect(() => collectGuideTags("/**\n * @guide\n */\nconst EMPTY_VALUE = 1")).toThrow("EMPTY_VALUE");
    expect(() => collectGuideTags("/**\n * @display Empty\n */\nconst EMPTY_ICON = IconNames.Yes"))
      .toThrow("EMPTY_ICON");
  });

  it("throws naming both constants when two displays would share an image", () => {
    const source = "/**\n * @display Found\n * One.\n */\nconst A_ICON = IconNames.Yes\n" +
      "/**\n * @display Found\n * Two.\n */\nconst B_ICON = IconNames.No";
    expect(() => collectGuideTags(source)).toThrow(/A_ICON.*B_ICON/);
  });

  it("throws when an icon is used without a tagged constant", () => {
    expect(() => collectGuideTags("basic.showIcon(IconNames.Heart, 0)")).toThrow("IconNames");
  });

  it("allows IconNames as a type", () => {
    expect(() => collectGuideTags("function f(icon: IconNames) {}")).not.toThrow();
  });
});

describe("iconPatterns", () => {
  it("reads each icon as 25 characters, row by row", () => {
    const iconsTs = `
namespace basic {
    export function iconImage(i: IconNames): Image {
        switch (i) {
            case IconNames.Asleep: return images.createImage(\`
                . . . . .
                # # . # #
                . . . . .
                . # # # .
                . . . . .
                \`)
            case IconNames.Yes: return images.createImage(\`
                . . . . .
                . . . . #
                . . . # .
                # . # . .
                . # . . .
                \`)
        }
    }
}`;
    expect(iconPatterns(iconsTs)).toEqual({
      Asleep: ".....##.##......###......",
      Yes: ".........#...#.#.#...#..."
    });
  });
});

describe("displayImageName", () => {
  it("lowercases the title and hyphenates spaces", () => {
    const display = { title: "Found", constName: "FOUND_ICON", icon: "Surprised", description: "x" };
    expect(displayImageName(display)).toBe("display-found.svg");
    expect(displayImageName({ ...display, title: "Free Run" })).toBe("display-free-run.svg");
  });
});

describe("renderGuideSections", () => {
  it("renders a displays row and values rows", () => {
    const tags = {
      displays: [{ title: "Found", constName: "FOUND_ICON", icon: "Surprised", description: "a | b" }],
      values: [
        { constName: "ICON_MS", description: "Icon time.", value: 3000 },
        { constName: "RX_BUFFER_SIZE", description: "Buffer.", value: 128 },
        { constName: "SHORT_MS", description: "Short.", value: 100 }
      ]
    };
    const { displays, values } = renderGuideSections(tags);
    expect(displays).toBe([
      "| Display | When it shows |",
      "| --- | --- |",
      "| <img src=\"guide-images/display-found.svg\" alt=\"Found icon\" width=\"160\"><br>**Found** | a \\| b |"
    ].join("\n"));
    expect(values).toBe([
      "| Setting | Value |",
      "| --- | --- |",
      "| Icon time. | 3,000 ms |",
      "| Buffer. | 128 |",
      "| Short. | 100 ms |"
    ].join("\n"));
  });
});

describe("replaceGuideSections and readGuideSections", () => {
  const guide = ["# Guide", "", kStart("displays"), "old", kEnd("displays"), "", "Prose  ", "",
    kStart("values"), kNote, "older", kEnd("values"), "tail\n"].join("\n");
  const sections = { displays: "| a |\n| b |", values: "| c |" };

  it("replaces only what lies between the markers", () => {
    const result = replaceGuideSections(guide, sections);
    expect(result).toBe(["# Guide", "", kStart("displays"), kNote, sections.displays, kEnd("displays"), "",
      "Prose  ", "", kStart("values"), kNote, sections.values, kEnd("values"), "tail\n"].join("\n"));
  });

  it("reads back what was written", () => {
    expect(readGuideSections(replaceGuideSections(guide, sections))).toEqual(sections);
  });

  it("throws for a section with no marker pair", () => {
    expect(() => replaceGuideSections(guide, { ...sections, extra: "x" })).toThrow("extra");
  });

  it("throws for a marker pair with no section", () => {
    expect(() => replaceGuideSections(guide, { displays: "x" })).toThrow("values");
  });

  it("throws for two start markers with the same name", () => {
    const twice = [kStart("displays"), "a", kEnd("displays"), kStart("displays"), "b", kEnd("displays")].join("\n");
    expect(() => replaceGuideSections(twice, { displays: "x" })).toThrow("two generated sections");
  });

  it("throws for an unclosed start marker", () => {
    const unclosed = `${kStart("displays")}\nold\n`;
    expect(() => replaceGuideSections(unclosed, { displays: "x" })).toThrow("displays");
  });
});

describe("the firmware's guide", () => {
  const firmwareDir = path.join(__dirname, "../../plugins/dataflow/firmware");
  const source = fs.readFileSync(path.join(firmwareDir, "spikerbit-clue.ts"), "utf8");
  const guide = fs.readFileSync(path.join(firmwareDir, "user-guide.md"), "utf8");

  it("the committed guide's generated sections match spikerbit-clue.ts", () => {
    expect(readGuideSections(guide)).toEqual(renderGuideSections(collectGuideTags(source)));
  });

  it("describes the Waiting, Found, Connected, Identify and Streaming displays, in that order", () => {
    expect(collectGuideTags(source).displays.map(display => display.title))
      .toEqual(["Waiting", "Found", "Connected", "Identify", "Streaming"]);
  });

  it("contains the firmware's hello line", () => {
    const hello = /const HELLO = "([^"]+)"/.exec(source)?.[1];
    expect(hello).toBeTruthy();
    expect(guide).toContain(hello!);
  });

  // The guide and cc-device-protocol.md both write out a connection transcript with checksums.
  it.each([
    ["the guide", path.join(firmwareDir, "user-guide.md")],
    ["cc-device-protocol.md", path.join(__dirname, "../../plugins/dataflow/docs/cc-device-protocol.md")]
  ])("%s writes only valid checksums in its code blocks", (_name, file) => {
    const codeLines: string[] = [];
    let inCode = false;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (line.startsWith("```")) inCode = !inCode;
      else if (inCode) codeLines.push(line);
    }
    const checksummed = codeLines
      .map(line => line.replace(/^(Dataflow|Spiker:bit):\s+/, "").trim())
      .map(line => /^(.*)\*([0-9A-Fa-f]{2})$/.exec(line))
      .filter(match => match !== null) as RegExpExecArray[];
    expect(checksummed.length).toBeGreaterThan(0);
    for (const [, body, checksum] of checksummed) {
      expect({ body, checksum: checksum.toUpperCase() }).toEqual({ body, checksum: ccChecksum(body) });
    }
  });

  it("states the icon time the firmware uses for the Connected and Identify displays", () => {
    const { displays, values } = collectGuideTags(source);
    const iconMs = values.find(value => value.constName === "ICON_MS")!.value;
    for (const title of ["Connected", "Identify"]) {
      expect(displays.find(display => display.title === title)!.description)
        .toContain(`${iconMs / 1000} seconds`);
    }
  });
});
