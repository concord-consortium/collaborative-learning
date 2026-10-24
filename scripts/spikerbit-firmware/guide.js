// Builds the generated sections of the Spiker:bit firmware user guide from the tagged comments in
// spikerbit-clue.ts. Requires only typescript, so Jest can load it without the MakeCode toolchain.
const ts = require("typescript");

const kGuideImageDir = "guide-images";
const kNote = "<!-- Generated from spikerbit-clue.ts by npm run build:firmware. Edit the comments there, not this section. -->";
const kStartMarker = /^<!-- generated: (\S+) -->$/;
const kIconSize = 25;

// The first paragraph of a tag's text, with its lines joined by single spaces.
function firstParagraph(text) {
  const lines = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") {
      if (lines.length) break;
      continue;
    }
    lines.push(line.trim());
  }
  return lines.join(" ");
}

function isIconNamesMember(node) {
  return ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
    node.expression.text === "IconNames";
}

function collectGuideTags(source) {
  const sourceFile = ts.createSourceFile("spikerbit-clue.ts", source, ts.ScriptTarget.Latest, true);
  const displays = [];
  const values = [];
  const allowedIconRefs = new Set();

  const visitDeclaration = (declaration, tags) => {
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
        allowedIconRefs.add(initializer);
        displays.push({ title: titleText, constName, icon: initializer.name.text, description });
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

  const visit = node => {
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
function iconPatterns(iconsTs) {
  const patterns = {};
  const pattern = /case IconNames\.(\w+):\s*return images\.createImage\(`([^`]*)`\)/g;
  let match;
  while ((match = pattern.exec(iconsTs))) {
    const pixels = match[2].replace(/[^#.]/g, "");
    if (pixels.length !== kIconSize) {
      throw new Error(`IconNames.${match[1]} has ${pixels.length} pixels, expected ${kIconSize}`);
    }
    patterns[match[1]] = pixels;
  }
  return patterns;
}

function displayImageName(display) {
  return `display-${display.title.toLowerCase().replace(/ /g, "-")}.svg`;
}

const escapeCell = text => text.replace(/\|/g, "\\|");

function formatValue(value) {
  return value >= 1000 ? value.toLocaleString("en-US") : String(value);
}

function renderGuideSections(tags) {
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
function findMarkerPairs(lines) {
  const pairs = {};
  lines.forEach((line, index) => {
    const match = kStartMarker.exec(line);
    if (!match) return;
    const name = match[1];
    const end = lines.indexOf(`<!-- end generated: ${name} -->`, index + 1);
    if (end < 0) throw new Error(`The generated section "${name}" has no end marker`);
    pairs[name] = { start: index, end };
  });
  return pairs;
}

function replaceGuideSections(guide, sections) {
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

function readGuideSections(guide) {
  const lines = guide.split("\n");
  const sections = {};
  for (const [name, { start, end }] of Object.entries(findMarkerPairs(lines))) {
    const body = lines.slice(start + 1, end);
    if (body[0] === kNote) body.shift();
    sections[name] = body.join("\n");
  }
  return sections;
}

module.exports = {
  collectGuideTags, iconPatterns, displayImageName, renderGuideSections, replaceGuideSections,
  readGuideSections, kGuideImageDir
};
