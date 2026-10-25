// Checks a real Spiker:bit's replies to the CC Device Protocol over USB serial.
// Usage: node bench.mjs [--port <path>] [--flash]
import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SerialPort } from "serialport";

const kBaudRate = 115200;
const kReplyTimeoutMs = 500;
const kCopyTimeoutMs = 30000;
// How long the board gets to reprogram before the first `?`, then to start answering it.
const kSettleMs = 10000;
const kBoardWaitMs = 30000;
const kFailTextTimeoutMs = 5000;
const kIdentifyAttempts = 5;
const kDriveDir = "/Volumes/MICROBIT";
const kHexPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../src/plugins/dataflow/firmware/spikerbit-clue.hex");
const kSourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../src/plugins/dataflow/firmware/spikerbit-clue.ts");
const kReadingPattern = /^[a-z0-9_/]+:-?\d+(\.\d+)?$/;
const kV1ToV3BannerPattern = /CLUE-SPIKERBIT v(\d+)/;

// The `hello` line, from `const HELLO = "..."` in the MakeCode source, so a firmware
// version bump doesn't leave the bench's first check expecting the old line.
function readExpectedHello() {
  const match = /const HELLO = "([^"]+)"/.exec(fs.readFileSync(kSourcePath, "utf8"));
  if (!match) throw new Error(`Could not find const HELLO = "..." in ${kSourcePath}`);
  return match[1];
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// XOR of every char code, as two uppercase hex digits. Same as ccChecksum in
// src/models/stores/cc-device-protocol.ts; this script is plain Node and can't import it.
function checksum(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum ^= body.charCodeAt(i);
  return (sum & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

const withChecksum = (body) => `${body}*${checksum(body)}`;

// Returns the body of a line whose checksum is present and right, or null.
function verifiedBody(line) {
  const star = line.lastIndexOf("*");
  if (star === -1) return null;
  const body = line.substring(0, star);
  return line.substring(star + 1) === checksum(body) ? body : null;
}

function parseArgs(argv) {
  const args = { port: undefined, flash: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port") args.port = argv[++i];
    else if (argv[i] === "--flash") args.flash = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function listPorts() {
  return fs.readdirSync("/dev").filter(name => name.startsWith("cu.usbmodem")).map(name => `/dev/${name}`);
}

function findPort(requested) {
  if (requested) return requested;
  const ports = listPorts();
  if (ports.length === 1) return ports[0];
  throw new Error(ports.length === 0
    ? "No port found: no /dev/cu.usbmodem* devices. Plug in the board or pass --port."
    : `More than one port found (${ports.join(", ")}). Pass --port.`);
}

// Runs a command on the board's drive as a child process and resolves with how it ended. The
// script never touches the drive itself (no fs calls on kDriveDir): while DAPLink programs the
// board and remounts the drive, file calls on it can block in the kernel and can't be
// interrupted. A child that does hang is abandoned, not waited for.
function runOnDrive(command, args, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(command, args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      resolve({ output: output.trim(), ...result });
    };
    const timer = setTimeout(() => finish({ timedOut: true }), timeoutMs);
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    child.on("error", err => { output += err.message; finish({ code: 1 }); });
    child.on("close", code => finish({ code }));
  });
}

// Copies the hex to the board's drive. `cp -X` leaves out extended attributes, which on the
// FAT drive become "._" files that make DAPLink's transfer fail.
async function copyHex(hexPath) {
  console.log(`Flashing ${hexPath}`);
  const result = await runOnDrive("cp", ["-X", hexPath, `${kDriveDir}/`], kCopyTimeoutMs);
  if (result.timedOut) {
    throw new StuckError("flash copy is stuck; unplug and replug the board");
  }
  if (result.code !== 0) throw new Error(`Flash copy failed: ${result.output}`);
}

// After flashing, the board reprograms and reboots; the serial port stays present throughout,
// so the only sign it's ready is that it answers `?`.
async function waitForBoard(requestedPort) {
  console.log(`Waiting ${kSettleMs / 1000} s for the board to reprogram`);
  await sleep(kSettleMs);
  const deadline = Date.now() + kBoardWaitMs;
  while (Date.now() < deadline) {
    let port;
    try {
      port = new SerialPort({ path: findPort(requestedPort), baudRate: kBaudRate, autoOpen: false });
      await new Promise((resolve, reject) => port.open(err => (err ? reject(err) : resolve())));
      const board = new Board(port);
      await board.send("?", { checksummed: false });
      const lines = await board.collect(1000);
      if (lines.some(line => kV1ToV3BannerPattern.test(line) || verifiedBody(line)?.startsWith("hello "))) return;
    } catch {
      await sleep(1000);
    } finally {
      if (port?.isOpen) await new Promise(resolve => port.close(() => resolve()));
    }
  }
  throw new Error(`The board didn't answer ? within ${kBoardWaitMs / 1000} s of the flash copy`);
}

// DAPLink writes FAIL.TXT to the drive when programming fails. Returns its text, or null.
async function readFailText() {
  const result = await runOnDrive("cat", [`${kDriveDir}/FAIL.TXT`], kFailTextTimeoutMs);
  return result.code === 0 && result.output ? result.output : null;
}

class StuckError extends Error {}

// Collects complete lines from the port, with the time each arrived.
class Board {
  constructor(port) {
    this.port = port;
    this.pending = "";
    this.lines = [];
    this.waiters = [];
    port.on("data", chunk => {
      this.pending += chunk.toString("latin1");
      let index;
      while ((index = this.pending.search(/\r?\n/)) !== -1) {
        const text = this.pending.substring(0, index);
        this.pending = this.pending.substring(this.pending.indexOf("\n", index) + 1);
        this.lines.push({ text, at: Date.now() });
      }
      this.waiters.forEach(wake => wake());
    });
  }

  write(text) {
    return new Promise((resolve, reject) => {
      this.port.write(text, err => (err ? reject(err) : this.port.drain(resolve)));
    });
  }

  // Sends one line; with a checksum unless told otherwise.
  send(body, { checksummed = true } = {}) {
    return this.write(`${checksummed ? withChecksum(body) : body}\n`);
  }

  // Throws away the complete lines so far (readings from before a command, say). A partly
  // received line stays in `pending` so its rest doesn't show up later as a fragment.
  clear() {
    this.lines = [];
  }

  // The first unread line that isn't a reading, within `ms`. Null if none arrives.
  async nextReply(ms = kReplyTimeoutMs) {
    const deadline = Date.now() + ms;
    for (;;) {
      const index = this.lines.findIndex(line => !isReading(line.text));
      if (index !== -1) return this.lines.splice(index, 1)[0].text;
      const left = deadline - Date.now();
      if (left <= 0) return null;
      await new Promise(resolve => {
        const wake = () => { clearTimeout(timer); this.waiters = this.waiters.filter(w => w !== wake); resolve(); };
        const timer = setTimeout(wake, left);
        this.waiters.push(wake);
      });
    }
  }

  // Every line that arrives over the next `ms`.
  async collect(ms) {
    await sleep(ms);
    const lines = this.lines.map(line => line.text);
    this.lines = [];
    return lines;
  }
}

function isReading(line) {
  const body = verifiedBody(line);
  return body !== null && kReadingPattern.test(body);
}

const describeLines = (lines) => (lines.length ? lines.map(l => JSON.stringify(l)).join(", ") : "nothing");

// Checks that a line is one valid-checksum reply with the expected body.
function checkReply(line, expected) {
  if (line === null) return `no reply within ${kReplyTimeoutMs} ms, expected ${JSON.stringify(expected)}`;
  const body = verifiedBody(line);
  if (body === null) return `reply ${JSON.stringify(line)} has a missing or wrong checksum`;
  if (body !== expected) return `got ${JSON.stringify(body)}, expected ${JSON.stringify(expected)}`;
  return null;
}

// Checks that only readings (with good checksums) arrive in `lines`, about one per 100 ms.
function checkReadings(lines, ms, min, max) {
  const bad = lines.filter(line => !isReading(line));
  if (bad.length) return `expected only readings, also got ${describeLines(bad)}`;
  return lines.length >= min && lines.length <= max
    ? null
    : `got ${lines.length} readings in ${ms} ms, expected ${min}-${max}`;
}

// The checks, run in order against one board; the state each leaves behind is the state the
// next one starts in. A check has a name and either:
//   send + reply: send that line (a function of the context, or a string) and expect one
//     reply line whose body is `reply`.
//   run(board, ctx): custom steps; returns null when it passes or a failure message.
// `#n` in a `send` string is the next sequence number.
function buildChecks() {
  return [
    { name: "? identifies the board", send: "?", reply: readExpectedHello() },
    { name: "open with a session id", send: ctx => `open session:${ctx.id} #n`, reply: ctx => `ok #${ctx.n}` },
    { name: "readings arrive about every 100 ms in a session",
      run: async (board) => {
        board.clear();
        return checkReadings(await board.collect(1000), 1000, 8, 12);
      } },
    { name: "ping with the session id -> ok", send: ctx => `ping session:${ctx.id} #n`, reply: ctx => `ok #${ctx.n}` },
    { name: "bare ping #n -> ok", send: "ping #n", reply: ctx => `ok #${ctx.n}` },
    { name: "ping with another id -> err othersession",
      send: ctx => `ping session:${ctx.id + 1} #n`, reply: ctx => `err #${ctx.n} othersession` },
    { name: "close ends the session", send: ctx => `close session:${ctx.id} #n`, reply: ctx => `ok #${ctx.n}` },
    { name: "open with timeout:1000, no pings: readings stop, ping -> err nosession",
      run: async (board, ctx) => {
        const n = ctx.nextSeq();
        await board.send(`open session:${ctx.id} timeout:1000 #${n}`);
        const openFailure = checkReply(await board.nextReply(), `ok #${n}`);
        if (openFailure) return `open: ${openFailure}`;
        await sleep(1000 + 300);
        board.clear();
        const quiet = await board.collect(500);
        if (quiet.length) return `readings kept coming after the timeout: ${describeLines(quiet)}`;
        const pingN = ctx.nextSeq();
        await board.send(`ping session:${ctx.id} #${pingN}`);
        return checkReply(await board.nextReply(), `err #${pingN} nosession`);
      } },
    { name: "idle is silent for 500 ms",
      run: async (board) => {
        board.clear();
        const lines = await board.collect(500);
        return lines.length ? `expected silence, got ${describeLines(lines)}` : null;
      } },
    { name: "stream -> readings",
      run: async (board, ctx) => {
        const n = ctx.nextSeq();
        board.clear();
        await board.send(`stream #${n}`);
        const failure = checkReply(await board.nextReply(), `ok #${n}`);
        if (failure) return failure;
        board.clear();
        return checkReadings(await board.collect(1000), 1000, 8, 12);
      } },
    { name: "stop -> silence",
      run: async (board, ctx) => {
        const n = ctx.nextSeq();
        await board.send(`stop #${n}`);
        const failure = checkReply(await board.nextReply(), `ok #${n}`);
        if (failure) return failure;
        board.clear();
        const lines = await board.collect(500);
        return lines.length ? `expected silence after stop, got ${describeLines(lines)}` : null;
      } },
    { name: "open for the stream/servo checks",
      send: ctx => `open session:${ctx.id} #n`, reply: ctx => `ok #${ctx.n}` },
    { name: "stream during a session -> err insession", send: "stream #n", reply: ctx => `err #${ctx.n} insession` },
    { name: "servo:90 -> ok", send: "servo:90 #n", reply: ctx => `ok #${ctx.n}` },
    { name: "servo:abc -> err value", send: "servo:abc #n", reply: ctx => `err #${ctx.n} value` },
    { name: "wrong checksum -> err checksum",
      run: async (board, ctx) => {
        const n = ctx.nextSeq();
        const body = `ping #${n}`;
        const wrong = (parseInt(checksum(body), 16) ^ 0x01).toString(16).toUpperCase().padStart(2, "0");
        await board.write(`${body}*${wrong}\n`);
        const line = await board.nextReply();
        // The board can't trust the #n in a line that failed its checksum, so it leaves it out.
        return checkReply(line, "err checksum");
      } },
    { name: "foo -> err unknown", send: "foo #n", reply: ctx => `err #${ctx.n} unknown` },
    { name: "a 200-character line -> err value, then later pings, alone or two in one write -> ok",
      run: async (board, ctx) => {
        board.clear();
        // Longer than the 128-character receive buffer, so the board drops its end and newline.
        await board.write(`${"x".repeat(200)}\n`);
        const longFailure = checkReply(await board.nextReply(), "err value");
        if (longFailure) return `200-character line: ${longFailure}`;
        const n = ctx.nextSeq();
        await board.send(`ping #${n}`);
        const pingFailure = checkReply(await board.nextReply(), `ok #${n}`);
        if (pingFailure) return `ping after it: ${pingFailure}`;
        const pair = [ctx.nextSeq(), ctx.nextSeq()];
        await board.write(pair.map(m => `${withChecksum(`ping #${m}`)}\n`).join(""));
        for (const m of pair) {
          const failure = checkReply(await board.nextReply(), `ok #${m}`);
          if (failure) return `two pings in one write: ${failure}`;
        }
        return null;
      } },
    { name: "identify #n -> ok", send: "identify #n", reply: ctx => `ok #${ctx.n}` },
    { name: "close leaves the board idle", send: ctx => `close session:${ctx.id} #n`, reply: ctx => `ok #${ctx.n}` },
  ];
}

async function runCheck(board, check, ctx) {
  try {
    if (check.run) return { failure: await check.run(board, ctx), sent: null };
    const n = ctx.nextSeq();
    const resolve = (value) => (typeof value === "function" ? value({ ...ctx, n }) : value).replace("#n", `#${n}`);
    const sent = resolve(check.send);
    const expected = resolve(check.reply);
    board.clear();
    await board.send(sent);
    const line = await board.nextReply();
    return { failure: checkReply(line, expected), sent: withChecksum(sent), got: line };
  } catch (err) {
    return { failure: `error: ${err.message}`, sent: null };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flash) {
    await copyHex(kHexPath);
    await waitForBoard(args.port);
    const failText = await readFailText();
    if (failText) throw new Error(`Flashing failed; the drive's FAIL.TXT says:\n${failText}`);
  }
  const portPath = findPort(args.port);
  console.log(`Using ${portPath}`);

  const port = new SerialPort({ path: portPath, baudRate: kBaudRate });
  await new Promise((resolve, reject) => port.on("open", resolve).on("error", reject));
  const board = new Board(port);
  let seq = 0;
  const ctx = {
    id: 1 + Math.floor(Math.random() * 65534),
    nextSeq: () => (seq = seq % 999 + 1),
  };
  let failed = 0;

  try {
    // Plain `?`, with no checksum: firmware v1–v3 compares the whole line to "?" and answers
    // with the v1–v3 banner. A board that has just rebooted may need a few tries to answer.
    let firstLines = [];
    let hello = false;
    for (let attempt = 0; attempt < kIdentifyAttempts && !hello; attempt++) {
      board.clear();
      await board.send("?", { checksummed: false });
      firstLines = await board.collect(1000);
      const banner = firstLines.map(line => kV1ToV3BannerPattern.exec(line)).find(Boolean);
      if (banner) {
        console.log(`running v${banner[1]} firmware; rerun with --flash`);
        failed = 1;
        return;
      }
      hello = firstLines.some(line => verifiedBody(line)?.startsWith("hello "));
    }
    if (!hello) {
      console.log("no reply to ?; is the board running this firmware? rerun with --flash " +
        `(got ${describeLines(firstLines)})`);
      failed = 1;
      return;
    }

    for (const check of buildChecks()) {
      const { failure, sent, got } = await runCheck(board, check, ctx);
      if (failure) {
        failed++;
        console.log(`FAIL ${check.name}`);
        if (sent) console.log(`     sent: ${JSON.stringify(sent)}`);
        const cameBack = got !== undefined && got !== null ? ` (came back: ${JSON.stringify(got)})` : "";
        console.log(`     ${failure}${cameBack}`);
      } else {
        console.log(`PASS ${check.name}`);
      }
    }
  } finally {
    // Leave the board idle even when a check failed partway.
    try { await board.send(`close session:${ctx.id}`); } catch { /* port may be gone */ }
    await sleep(100);
    await new Promise(resolve => port.close(() => resolve()));
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
  // A stuck copy can't be waited for or killed, so don't let it keep the process alive.
  if (err instanceof StuckError) process.exit(1);
});
