/*
 * Find all exemplars in a given curriculum unit.
 * For each exemplar, extract the content.
 * Save the summaries to a file.
 *
 * Eventually, this will create contextualized examples to attach to the exemplars.
 *
 * The input file is a JSON file, usually called 'content.json' in the curriculum unit directory.
 *
 * Usage:
 *   export OPENAI_API_KEY=<your-api-key>
 *   npx tsx create-examples-for-exemplars.ts <input-file> [output-file]
*/


import * as fs from 'fs';
import * as path from 'path';
import { summarizeCurriculum } from '../lib/simple-ai-summarizer';

interface Problem {
  description: string;
  ordinal: number;
  title: string;
  subtitle?: string;
  disabled: string[];
  sections: string[];
  exemplars?: string[];
  config?: any;
}

interface Investigation {
  description: string;
  ordinal: number;
  title: string;
  problems: Problem[];
}

interface CurriculumData {
  code: string;
  abbrevTitle: string;
  title: string;
  subtitle: string;
  placeholderText: string;
  config: any;
  sections: any;
  planningDocument: any;
  investigations: Investigation[];
}

function extractExemplarPaths(data: CurriculumData): string[] {
  const exemplarPaths: string[] = [];

  data.investigations.forEach((investigation) => {
    investigation.problems.forEach((problem) => {
      if (problem.exemplars && Array.isArray(problem.exemplars)) {
        problem.exemplars.forEach((exemplarPath) => {
          exemplarPaths.push(exemplarPath);
        });
      }
    });
  });

  return [...new Set(exemplarPaths)];
}

function readAndExtractExemplars(filePath: string): string[] {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data: CurriculumData = JSON.parse(fileContent);

    return extractExemplarPaths(data);
  } catch (error) {
    console.error('Error reading or parsing file:', error);
    return [];
  }
}

function printExemplarPaths(exemplarPaths: string[]): void {
  console.log(`Found ${exemplarPaths.length} exemplar paths:\n`);

  exemplarPaths.forEach((exemplarPath, index) => {
    console.log(`   Path: ${exemplarPath}\n`);
  });
}

function saveExemplarPathsToFile(exemplarPaths: string[], outputPath: string): void {
  try {
    const output = {
      totalCount: exemplarPaths.length,
      exemplars: exemplarPaths
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Exemplar paths saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error saving exemplar paths:', error);
  }
}

function readExemplar(exemplarPath: string, baseDir: string): any {
  // Resolve the path relative to the base directory
  const resolvedPath = path.resolve(baseDir, exemplarPath);
  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  const data: CurriculumData = JSON.parse(fileContent);
  console.log("Read exemplar", resolvedPath);
  if ("content" in data) {
    const summary = summarizeCurriculum(data.content);
    return summary;
  } else {
    console.log("No content in", exemplarPath);
    return null;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: ts-node create-examples-for-exemplars.ts <input-file> [output-file]');
    console.log('Example: ts-node create-examples-for-exemplars.ts curriculum-data.json exemplar-paths.json');
    process.exit(1);
  }

  const inputFile = args[0];
  const inputDir = path.dirname(inputFile);
  const outputFile = args[1] || 'exemplar-paths.json';

  console.log(`Reading exemplar paths from: ${inputFile}`);

  const exemplarPaths = readAndExtractExemplars(inputFile);

  if (exemplarPaths.length === 0) {
    console.log('No exemplar paths found in the file.');
    return;
  }

  // printExemplarPaths(exemplarPaths);
  // saveExemplarPathsToFile(exemplarPaths, outputFile);
  for (const exemplarPath of exemplarPaths) {
    const exemplar = readExemplar(exemplarPath, inputDir);
    console.log(exemplar);
  }
}

// Run the script if called directly
main();
