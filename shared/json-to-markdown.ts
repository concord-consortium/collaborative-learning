// Utility to flatten nested JSON with dot notation keys
function flattenJsonCondensed(
  obj: any,
  prefix = '',
  result: Record<string, string> = {}
): Record<string, string> {
  if (obj === null) {
    result[prefix] = 'null';
  } else if (Array.isArray(obj)) {
    // Combine primitives into a single list
    if (obj.every(item => typeof item !== 'object' || item === null)) {
      const joined = obj.map(formatValue).join(', ');
      result[prefix] = `[${joined}]`;
    } else {
      obj.forEach((item, index) => {
        const key = `${prefix}[${index}]`;
        if (typeof item === 'object' && item !== null) {
          flattenJsonCondensed(item, key, result);
        } else {
          result[key] = formatValue(item);
        }
      });
    }
  } else if (typeof obj === 'object') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      flattenJsonCondensed(obj[key], fullKey, result);
    }
  } else {
    result[prefix] = formatValue(obj);
  }

  return result;
}

// Helper to format primitive values for consistent Markdown
function formatValue(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

// Generates a natural language summary from flattened JSON
function generateDescription(flat: Record<string, string>): string {
  const topLevel: [string, string][] = [];
  const grouped: Record<string, [string, string][]> = {};

  // Partition into top-level and grouped entries
  for (const fullKey of Object.keys(flat)) {
    const parts = fullKey.split('.');
    const key = parts.pop()!;
    const group = parts.join('.'); // "" for top-level

    if (group === '') {
      topLevel.push([key, flat[fullKey]]);
    } else {
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push([key, flat[fullKey]]);
    }
  }

  const sentences: string[] = [];

  // Sort and describe top-level keys
  const sortedTopLevel = topLevel.sort(([a], [b]) => a.localeCompare(b));
  const topPhrases: string[] = [];

  for (const [key, rawValue] of sortedTopLevel) {
    let value = rawValue;

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    if (value === 'true') {
      topPhrases.push(`it is ${key}`);
    } else if (value === 'false') {
      topPhrases.push(`it is not ${key}`);
    } else if (value === 'null') {
      topPhrases.push(`the ${key} is not set`);
    } else if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1);
      if (items.length > 0) {
        topPhrases.push(`the ${key} includes ${items}`);
      }
    } else if (isNaN(Number(value))) {
      topPhrases.push(`the ${key} is "${value}"`);
    } else {
      topPhrases.push(`the ${key} is ${value}`);
    }
  }

  if (topPhrases.length > 0) {
    const last = topPhrases.pop()!;
    const combined = topPhrases.length > 0
      ? `${topPhrases.join(', ')} and ${last}`
      : last;
    sentences.push(capitalize(combined) + '.');
  }

  // Sort group names and describe each group in its own sentence
  const groupNames = Object.keys(grouped).sort();

  for (const group of groupNames) {
    const entries = grouped[group].sort(([a], [b]) => a.localeCompare(b));
    const groupPhrases: string[] = [];

    for (const [key, rawValue] of entries) {
      let value = rawValue;

      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      if (value === 'true') {
        groupPhrases.push(`it is ${key}`);
      } else if (value === 'false') {
        groupPhrases.push(`it is not ${key}`);
      } else if (value === 'null') {
        groupPhrases.push(`the ${key} is not set`);
      } else if (value.startsWith('[') && value.endsWith(']')) {
        const items = value.slice(1, -1);
        if (items.length > 0) {
          groupPhrases.push(`the ${key} includes ${items}`);
        }
      } else if (isNaN(Number(value))) {
        groupPhrases.push(`the ${key} is "${value}"`);
      } else {
        groupPhrases.push(`the ${key} is ${value}`);
      }
    }

    const last = groupPhrases.pop();
    const combined = groupPhrases.length > 0
      ? `${groupPhrases.join(', ')} and ${last}`
      : last;

    sentences.push(`Within ${group}, ${combined}.`);
  }

  return sentences.join(' ');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const keysToIgnore = ["id", "type", ];
// Converts JSON components into markdown format with a natural language summary
// eslint-disable-next-line max-len
export function jsonToMarkdownWithDescriptions(component: Record<string, any>): {description: string, markdown: string} {
  const cleanedComponent = JSON.parse(JSON.stringify(component, (key, value) => {
    if (keysToIgnore.includes(key)) {
      return undefined;
    }
    return value;
  }));
  const flat = flattenJsonCondensed(cleanedComponent);

  const markdown = Object.entries(flat)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const description = generateDescription(flat);

  return {description, markdown};
}
