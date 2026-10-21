// Runs pxt against the pinned target; a temp project has no node_modules/pxtcli.json for pxt to find it by.
const path = require("path");

const targetDir = path.dirname(require.resolve("pxt-microbit/package.json"));
require("pxt-core").mainCli(targetDir, process.argv.slice(2));
