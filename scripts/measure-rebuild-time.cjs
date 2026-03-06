#!/usr/bin/env node

/**
 * Measures webpack incremental rebuild times.
 *
 * Usage: node scripts/measure-rebuild-time.js [--samples N] [--file path/to/file.ts]
 *
 * This script:
 * 1. Starts webpack-dev-server
 * 2. Waits for initial compilation
 * 3. Touches a file to trigger rebuild
 * 4. Measures time until rebuild completes
 * 5. Repeats for N samples (default: 5)
 * 6. Reports statistics
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
let samples = 5;
let testFile = 'src/index.tsx'; // Default file to touch

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--samples' && args[i + 1]) {
    samples = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--file' && args[i + 1]) {
    testFile = args[i + 1];
    i++;
  }
}

const testFilePath = path.resolve(process.cwd(), testFile);

if (!fs.existsSync(testFilePath)) {
  console.error(`Error: File not found: ${testFilePath}`);
  process.exit(1);
}

console.log(`\n📊 Webpack Incremental Rebuild Benchmark`);
console.log(`   File to touch: ${testFile}`);
console.log(`   Samples: ${samples}\n`);

const rebuildTimes = [];
let initialBuildTime = null;
let compileStartTime = null;
let waitingForRebuild = false;
let currentSample = 0;

// Patterns to match webpack output
// Example: "webpack 5.76.0 compiled successfully in 31035 ms"
const compiledPattern = /webpack.*compiled.*?in\s+(\d+)\s*ms/i;

function touchFile() {
  const now = new Date();
  fs.utimesSync(testFilePath, now, now);
  compileStartTime = Date.now();
  waitingForRebuild = true;
  console.log(`   [${currentSample + 1}/${samples}] Touched file, waiting for rebuild...`);
}

function scheduleNextTouch() {
  currentSample++;
  if (currentSample < samples) {
    // Wait a bit before next touch to let things settle
    setTimeout(touchFile, 2000);
  } else {
    printResults();
    process.exit(0);
  }
}

function printResults() {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📈 Results\n`);

  if (initialBuildTime) {
    console.log(`   Initial build:     ${initialBuildTime}ms`);
  }

  if (rebuildTimes.length > 0) {
    const min = Math.min(...rebuildTimes);
    const max = Math.max(...rebuildTimes);
    const avg = rebuildTimes.reduce((a, b) => a + b, 0) / rebuildTimes.length;
    const sorted = [...rebuildTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    console.log(`\n   Incremental rebuilds (${rebuildTimes.length} samples):`);
    console.log(`   ├─ Min:            ${min}ms`);
    console.log(`   ├─ Max:            ${max}ms`);
    console.log(`   ├─ Average:        ${Math.round(avg)}ms`);
    console.log(`   └─ Median:         ${median}ms`);
    console.log(`\n   Raw times: [${rebuildTimes.join(', ')}]ms`);
  }

  console.log(`${'─'.repeat(50)}\n`);
}

// Start webpack-dev-server
console.log('🚀 Starting webpack-dev-server...\n');

const webpack = spawn('npm', ['start'], {
  cwd: process.cwd(),
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

let initialBuildComplete = false;

webpack.stdout.on('data', (data) => {
  const output = data.toString();

  // Check for compilation complete
  const compiledMatch = output.match(compiledPattern);

  if (compiledMatch) {
    const reportedTime = parseInt(compiledMatch[1], 10);

    if (!initialBuildComplete) {
      initialBuildComplete = true;
      initialBuildTime = reportedTime;
      console.log(`   ✅ Initial build complete: ${reportedTime}ms\n`);
      console.log(`${'─'.repeat(50)}`);
      console.log(`   Starting incremental rebuild measurements...\n`);

      // Start first measurement after a short delay
      setTimeout(touchFile, 2000);
    } else if (waitingForRebuild) {
      // This is an incremental rebuild
      const measuredTime = Date.now() - compileStartTime;
      rebuildTimes.push(reportedTime);
      console.log(`   ✅ Rebuild complete: ${reportedTime}ms (wall clock: ${measuredTime}ms)`);
      waitingForRebuild = false;
      scheduleNextTouch();
    }
  }
});

webpack.stderr.on('data', (data) => {
  // Webpack often outputs to stderr too
  const output = data.toString();

  const compiledMatch = output.match(compiledPattern);

  if (compiledMatch && !initialBuildComplete) {
    initialBuildComplete = true;
    initialBuildTime = parseInt(compiledMatch[1], 10);
    console.log(`   ✅ Initial build complete: ${initialBuildTime}ms\n`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`   Starting incremental rebuild measurements...\n`);
    setTimeout(touchFile, 2000);
  }
});

webpack.on('error', (err) => {
  console.error('Failed to start webpack:', err);
  process.exit(1);
});

webpack.on('close', (code) => {
  if (code !== 0 && rebuildTimes.length === 0) {
    console.error(`Webpack exited with code ${code}`);
    process.exit(1);
  }
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted');
  if (rebuildTimes.length > 0) {
    printResults();
  }
  webpack.kill();
  process.exit(0);
});

// Timeout after 5 minutes if initial build doesn't complete
setTimeout(() => {
  if (!initialBuildComplete) {
    console.error('\n❌ Timeout: Initial build did not complete within 5 minutes');
    webpack.kill();
    process.exit(1);
  }
}, 5 * 60 * 1000);
