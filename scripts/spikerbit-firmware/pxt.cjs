// Runs the pxt command line against the pinned micro:bit target, e.g. `node pxt.cjs build`
// from inside a MakeCode project directory. The usual global `pxt` command does the same
// thing but finds the target through the current directory's node_modules.
const path = require("path");

const targetDir = path.dirname(require.resolve("pxt-microbit/package.json"));
require("pxt-core").mainCli(targetDir, process.argv.slice(2));
