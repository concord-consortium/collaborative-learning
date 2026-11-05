// Builds the generated sections of the Spiker:bit firmware user guide from the tagged comments in
// spikerbit-clue.ts. Requires only typescript, so Jest can load it without the MakeCode toolchain.
import ts from "typescript";

export interface GuideDisplay { title: string; constName: string; icon: string; description: string }
export interface GuideValue { constName: string; description: string; value: number }
export interface GuideTags { displays: GuideDisplay[]; values: GuideValue[] }
export type GuideSections = Record<string, string>;

export const kGuideImageDir = "guide-images";
const kNote = "<!-- Generated from spikerbit-clue.ts by npm run build:firmware. " +
  "Edit the comments there, not this section. -->";
const kStartMarker = /^<!-- generated: (\S+) -->$/;
const kIconSize = 25;

// The first paragraph of a tag's text, with its lines joined by single spaces.
function firstParagraph(text: string) {
  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") {
      if (lines.length) break;
      continue;
    }
    lines.push(line.trim());
  }
  return lines.join(" ");
}

function isIconNamesMember(node: ts.Node): node is ts.PropertyAccessExpression {
  return ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
    node.expression.text === "IconNames";
}

export function collectGuideTags(source: string): GuideTags {
  const sourceFile = ts.createSourceFile("spikerbit-clue.ts", source, ts.ScriptTarget.Latest, true);
  const displays: GuideDisplay[] = [];
  const values: GuideValue[] = [];
  const allowedIconRefs = new Set<ts.Node>();

  const visitDeclaration = (declaration: ts.VariableDeclaration, tags: readonly ts.JSDocTag[]) => {
    const constName = declaration.name.getText(sourceFile);
    const initializer = declaration.initializer;
    for (const tag of tags) {
      const tagName = tag.tagName.text;
      const text = ts.getTextOfJSDocComment(tag.comment) || "";
      if (tagName === "display") {
        if (!initializer || !isIconNamesMember(initializer)) {
          throw new Error(`${constName}: a @display constant must be initialized with IconNames.<Member>`);
        }
        const newline = text.indexOf("\n");
        const titleText = (newline < 0 ? text : text.slice(0, newline)).trim();
        const description = newline < 0 ? "" : firstParagraph(text.slice(newline + 1));
        if (!description) throw new Error(`${constName}: a @display constant needs a description`);
        const display = { title: titleText, constName, icon: initializer.name.text, description };
        const sharing = displays.find(other => displayImageName(other) === displayImageName(display));
        if (sharing) {
          throw new Error(`${sharing.constName} and ${constName} are both titled "${titleText}", ` +
            "so they would share one image; give them different titles");
        }
        allowedIconRefs.add(initializer);
        displays.push(display);
      } else if (tagName === "guide") {
        if (!initializer || !ts.isNumericLiteral(initializer)) {
          throw new Error(`${constName}: a @guide constant must be initialized with a number`);
        }
        const description = firstParagraph(text);
        if (!description) throw new Error(`${constName}: a @guide constant needs a description`);
        values.push({ constName, description, value: Number(initializer.text) });
      }
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const tags = ts.getJSDocTags(declaration)
          .filter(tag => tag.tagName.text === "display" || tag.tagName.text === "guide");
        if (tags.length) visitDeclaration(declaration, tags);
      }
    }
    if (isIconNamesMember(node) && !allowedIconRefs.has(node)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      throw new Error(`${node.getText(sourceFile)} on line ${line + 1} is used outside a @display constant`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { displays, values };
}

// Maps each `case IconNames.X: return images.createImage(`...`)` to its 25 pixels as `#` and `.`.
export function iconPatterns(iconsTs: string): Record<string, string> {
  const patterns: Record<string, string> = {};
  const pattern = /case IconNames\.(\w+):\s*return images\.createImage\(`([^`]*)`\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(iconsTs))) {
    const pixels = match[2].replace(/[^#.]/g, "");
    if (pixels.length !== kIconSize) {
      throw new Error(`IconNames.${match[1]} has ${pixels.length} pixels, expected ${kIconSize}`);
    }
    patterns[match[1]] = pixels;
  }
  return patterns;
}

export function displayImageName(display: GuideDisplay) {
  return `display-${display.title.toLowerCase().replace(/ /g, "-")}.svg`;
}

const escapeCell = (text: string) => text.replace(/\|/g, "\\|");

function formatValue(value: number) {
  return value >= 1000 ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : String(value);
}

export function renderGuideSections(tags: GuideTags): Record<"displays" | "values", string> {
  const displayRows = tags.displays.map(display =>
    `| <img src="${kGuideImageDir}/${displayImageName(display)}" alt="${display.title} icon" width="160">` +
    `<br>**${display.title}** | ${escapeCell(display.description)} |`);
  const valueRows = tags.values.map(({ constName, description, value }) =>
    `| ${escapeCell(description)} | ${formatValue(value)}${constName.endsWith("_MS") ? " ms" : ""} |`);
  return {
    displays: ["| Display | When it shows |", "| --- | --- |", ...displayRows].join("\n"),
    values: ["| Setting | Value |", "| --- | --- |", ...valueRows].join("\n")
  };
}

// Finds each marker pair as line indexes: { name: { start, end } }.
function findMarkerPairs(lines: string[]) {
  const pairs: Record<string, { start: number; end: number }> = {};
  lines.forEach((line, index) => {
    const match = kStartMarker.exec(line);
    if (!match) return;
    const name = match[1];
    if (name in pairs) throw new Error(`The guide has two generated sections named "${name}"`);
    const end = lines.indexOf(`<!-- end generated: ${name} -->`, index + 1);
    if (end < 0) throw new Error(`The generated section "${name}" has no end marker`);
    pairs[name] = { start: index, end };
  });
  return pairs;
}

export function replaceGuideSections(guide: string, sections: GuideSections) {
  const lines = guide.split("\n");
  const pairs = findMarkerPairs(lines);
  for (const name of Object.keys(sections)) {
    if (!pairs[name]) throw new Error(`The guide has no markers for the generated section "${name}"`);
  }
  for (const name of Object.keys(pairs)) {
    if (!(name in sections)) throw new Error(`The guide has markers for "${name}" but no section was generated`);
  }
  const ordered = Object.entries(pairs).sort((a, b) => b[1].start - a[1].start);
  for (const [name, { start, end }] of ordered) {
    const content = sections[name] === "" ? [] : sections[name].split("\n");
    lines.splice(start + 1, end - start - 1, kNote, ...content);
  }
  return lines.join("\n");
}

export function readGuideSections(guide: string): GuideSections {
  const lines = guide.split("\n");
  const sections: GuideSections = {};
  for (const [name, { start, end }] of Object.entries(findMarkerPairs(lines))) {
    const body = lines.slice(start + 1, end);
    if (body[0] === kNote) body.shift();
    sections[name] = body.join("\n");
  }
  return sections;
}
