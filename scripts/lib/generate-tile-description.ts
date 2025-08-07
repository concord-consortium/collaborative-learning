// TODO: This is a copy of the shared/generate-tile-description.ts file.
// Importing from shared fails in the offline script context.
// Doug suggests: create an npm script to build/package the ai-summarizer.ts file into a standalone bundle with
// a .d.ts file emitted so that you could then import it as javascript into the scripts folder.
// That would fix all the module import errors.

// do not import the tile types as some are defined within the same file as the model
// and we do not want to import MobX
const kNumberlineTileType = "Numberline";
const kTableTileType = "Table";
const kDrawingTileType = "Drawing";
const kExpressionTileType = "Expression";

const univeralKeysToIgnore = ["id"];
const topLevelKeysToIgnore = ["type",];
const topLevelKeysToIgnorePerComponentType: Record<string, string[]> = {
  [kDrawingTileType]: ["stamps"],
  [kTableTileType]: ["importedDataSet", "isImported", "columnWidths"],
};

// Generates a natural language summary from flattened JSON
export function generateTileDescription(node: Record<string, any>): string {
  const phrases: string[] = [];
  let keys = Object.keys(node);

  keys = keys.filter(key => !univeralKeysToIgnore.includes(key));
  keys = keys.filter(key => !topLevelKeysToIgnore.includes(key));

  // remove keys specific to component types
  const componentType = node.type;
  if (componentType && topLevelKeysToIgnorePerComponentType[componentType]) {
    const keysToIgnore = topLevelKeysToIgnorePerComponentType[componentType];
    keys = keys.filter(key => !keysToIgnore.includes(key));
  }

  keys = keys.sort();

  for (const key of keys) {
    let value = node[key];

    if (value === undefined || value === null) {
      phrases.push(`${key} is not set`);
      continue;
    }

    switch (typeof value) {
      case "boolean":
        phrases.push(`${key} is ${value}`);
        break;

      case "number":
        if (isNaN(value)) {
          phrases.push(`${key} is not a valid number`);
        } else {
          phrases.push(`${key} is ${value}`);
        }
        break;

      case "string":
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        if (value.length === 0) {
          phrases.push(`${key} is an empty string`);
        } else {
          phrases.push(`${key} is "${value}"`);
        }
        break;

      case "object":
        value = Array.isArray(value) ? value : Object.values(value);
        if (value.length === 0) {
          phrases.push(`${key} is an empty array`);
        } else {
          const commonAttributes = getCommonAttributes(value);
          // eslint-disable-next-line max-len
          phrases.push(`${key} is an array of ${pluralize(value.length, 'item')} with ${pluralize(commonAttributes.length, 'common attribute')}${commonAttributes.length > 0 ? ` (${oxFordAnd(commonAttributes).join(', ')})` : ''}`);
        }
        break;
    }
  }

  const description = phrases.length === 0
    ? "there are no properties to describe"
    : `properties, ${oxFordAnd(phrases).join(', ')}`;

  return `In the ${node.type.toLowerCase()} content ${description}.${getExtraDescription(node)}`;
}

function pluralize(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

function getCommonAttributes(value: any[]): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  const commonAttributes: string[] = [];
  const firstItem = value[0];
  const keys = Object.keys(firstItem).filter(key => !univeralKeysToIgnore.includes(key));

  for (const key of keys) {
    // eslint-disable-next-line no-prototype-builtins
    if (firstItem.hasOwnProperty(key)) {
      const allValues = value.map(item => item[key]).filter(val => val !== undefined);
      if (allValues.length === value.length) {
        commonAttributes.push(key);
      }
    }
  }

  return commonAttributes;
}

function oxFordAnd(array: string[]): string[] {
  if (array.length > 1) {
    const lastPhrase = array.pop();
    if (lastPhrase) {
      array.push(`and ${lastPhrase}`);
    }
  }
  return array;
}

function getExtraDescription(node: any): string {
  let result: string|undefined = undefined;
  let points: any[] = [];

  switch (node.type) {
    case kDrawingTileType:
      if (node.objects && node.objects.length > 0) {
        const types = node.objects.map((obj: any) => obj.type);
        result = `The objects in the drawing tile content are: ${oxFordAnd(types).join(', ')}.`;
      }
      break;

    case kNumberlineTileType:
      if (node.points) {
        points = Object.values(node.points || {});
        if (points && points.length > 0) {
          const pointDescriptions = points.map((point: any) => point.xValue);
          // eslint-disable-next-line max-len
          result = `The xValues for the points property in the number line tile content are: ${oxFordAnd(pointDescriptions).join(', ')}.`;
        }
      }
      break;

    case kExpressionTileType:
      if (node.latexStr) {
        result = "The latexStr property contains the LaTeX representation of the expression.";
      }
      break;

    default:
      // No additional information for other types
      break;
  }

  if (result === undefined) {
    return "";
  }

  return `\n\n${result}`;
}
