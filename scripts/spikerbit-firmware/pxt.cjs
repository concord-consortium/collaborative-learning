// Runs the pxt command line against the pinned micro:bit target, e.g. `node pxt.cjs build`
// from inside a MakeCode project directory. The usual `pxt` command finds the target by
// searching up from the current directory for the `node_modules/pxtcli.json` that
// `pxt target microbit` writes, and the temporary project has none.
const path = require("path");

const targetDir = path.dirname(require.resolve("pxt-microbit/package.json"));
require("pxt-core").mainCli(targetDir, process.argv.slice(2));
