// pxt-core depends on puppeteer, which downloads Chrome when installed. The firmware build
// never starts a browser, so skip that download.
module.exports = { skipDownload: true };
