import fs from 'fs';
import path from 'path';
import gitRepoInfo from 'git-repo-info';

// Writes information about the git repository to version.json
// This is used to identify the version of the app and to track errors
// in the rollbar dashboard.

const info = gitRepoInfo();

const version = {
  gitSha: info.sha || null,
  branch: info.branch || null,
  tag: info.tag || null,
  date: info.committerDate || null,
};

const outPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../version.json');
fs.writeFileSync(outPath, JSON.stringify(version, null, 2));
console.log('Wrote version information to', outPath);
