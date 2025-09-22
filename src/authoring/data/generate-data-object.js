/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, max-len, no-undef */

// generate-data-object.js
// Usage: node generate-data-object.js > src/authoring/data/data.ts
// This script recursively reads all JSON files in 'cas' and 'mods' and generates a data.ts file exporting a nested object.


const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const CAS_DIR = path.join(DATA_DIR, 'cas');
const MODS_DIR = path.join(DATA_DIR, 'mods');
const BRAIN_DIR = path.join(DATA_DIR, 'brain');
const M2S_DIR = path.join(DATA_DIR, 'm2s');

function walkFiles(dir, baseDir) {
  let results = {};
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = { ...results, ...walkFiles(filePath, baseDir) };
    } else if (file.endsWith('.json')) {
      const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
      try {
        results[relPath] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        results[relPath] = null;
      }
    }
  }
  return results;
}

const data = {
  ...walkFiles(CAS_DIR, DATA_DIR),
  ...walkFiles(MODS_DIR, DATA_DIR),
  ...walkFiles(BRAIN_DIR, DATA_DIR),
  ...walkFiles(M2S_DIR, DATA_DIR),
};

const output = `// AUTO-GENERATED FILE. DO NOT EDIT.\n// Run 'node generate-data-object.js' to regenerate.\n\n/* eslint-disable max-len */\n\nexport const data = ${JSON.stringify(data, null, 2)};\n\n/* eslint-enable max-len */\n`;

console.log(output);

/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, max-len, no-undef */
