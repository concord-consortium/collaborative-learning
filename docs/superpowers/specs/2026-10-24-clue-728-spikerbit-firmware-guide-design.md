# Spiker:bit firmware guide (CLUE-728)

## Intent

A guide to the Spiker:bit firmware for people deciding whether to use or extend it: project
managers and the developers they work with who are evaluating CLUE and Dataflow, internal
developers who are new to Dataflow or coming back to it, and anyone who wants to drive the
firmware from something other than Dataflow. Teachers and students are not the audience.

The parts of the guide that describe the firmware's behavior (its LED displays and the numbers
that govern its timing) are generated from the firmware source, so the guide can't drift from
the firmware. The rest is hand-written.

It ships in the first CLUE-728 PR (#3056, `CLUE-728-protocol-firmware` →
`CLUE-728-spikerbit-status`), alongside the firmware it describes. The PR goes past the
usual ~25 files; that was accepted.

## Goals

- **The guide stands alone.** A reader can understand, flash, try and drive the firmware from
  the guide without opening `serial-protocols.md`. Facts both docs state are duplicated, not
  linked.
- **Each LED display is shown as a picture** of a micro:bit with that display's LEDs lit,
  with a description of when it is shown.
- **The display descriptions live next to the code,** in JSDoc-style comments on the icon
  constants in `spikerbit-clue.ts`, so whoever changes a display edits its description in the
  same place.
- **Generated content can't go stale unnoticed:** the existing firmware build regenerates it
  and the existing firmware CI check fails when the committed guide differs.

## Non-goals

- A guide for teachers or students, or for using the Dataflow tile.
- Generating the hand-written parts, such as the command table or the walkthroughs.
- Changing the firmware's behavior. Only comments and constant declarations change, so
  `firmware:` stays 4.

## Anti-goals

- Two docs that each describe the commands in their own words with nothing to catch a
  disagreement between them.
- A generator that needs a browser, network access or a manual step to run.
- Generated sections that someone can hand-edit and commit without any check failing.

## The two documents

**`src/plugins/dataflow/docs/serial-protocols.md`, CC Device Protocol section: the protocol.**
How it is designed and how it is extended; what any CC device and host must agree on. It keeps:

- the line format, checksums, `#n`, `ok`/`err` and the error reasons;
- the name and value rules, and the compatibility rules;
- the states every device has: **idle** and **session**;
- the core commands every device answers: `?` and its `hello` line, `open`, `ping` and
  `close`;
- `identify`, as an **optional** command a device may support;
- the reserved extensions (`caps`, `set`, binary mode) and how a new verb, output or setting
  is added;
- how a host recognizes the firmware. Dataflow's session, `CcDeviceSession`, is described
  there by #3055, which adds it.

The Spiker:bit's own material (free-run, `stream`/`stop`, `servo`, the `emg` reading, the
displays and the firmware notes) is in the guide, and the protocol section has a short pointer
to it. The protocol section keeps a connection transcript as an example.

**The guide: this firmware.** It covers:

- what the board does: EMG in on P1, a servo out on P0, USB serial at 115200;
- getting the hex onto a board (Dataflow flashes it automatically; otherwise copy it to the
  `MICROBIT` drive);
- **Talking to it**: line endings, optional checksums and how to compute one, `#n` and
  `ok #n`, what each `err` reason means for this board, and a transcript of a session. "For
  this board" means which of its commands can produce each reason, worked out from the firmware
  source and matching the command table;
- the full command table for this firmware, the core commands included, plus `servo`,
  `identify`, `stream` and `stop`, the `emg` reading and the `hello` values;
- its states, idle, session and free-run, and the button A long press;
- **its LED displays** (generated, with pictures);
- **timing and limits** (generated);
- the sound rule (built-in speaker only, so the servo doesn't twitch; a V1 shows the icon
  without sound) and the pins it uses;
- trying it by hand in serialterminal.com, and plotting it in MakeCode;
- driving it from your own app: what a host has to do (send `?`, check `hello`, `open`, ping
  every second, `close`), with a pointer to Dataflow's parser,
  `src/models/stores/cc-device-protocol.ts`. #3055 adds `cc-device-session.ts` as the
  reference implementation;
- where to go next: the protocol section, the source, the simulator tests, the bench script.

**`src/plugins/dataflow/firmware/README.md`** is the developer page: building and
rebuilding the hex, the CI checks, testing in Jest, the bench script, prototyping in MakeCode,
upgrading MakeCode, and the hardware reference. It links to the guide at the top, and has a
short section on regenerating the guide.

## How the guide is generated

### In the firmware

Each display constant gets a JSDoc block with a `@display` tag naming the display, and a
description:

```ts
/**
 * @display Found
 * Shown after a `?` while idle: Dataflow saw the board but hasn't opened a session.
 * If it stays, the version check or flashing failed.
 */
const FOUND_ICON = IconNames.Surprised
```

The descriptions are Markdown. The five displays are Waiting, Found, Connected, Identify and
Streaming.

Each constant that sets a number the guide states (the session timeout default and range, the
reading interval, how long the connected and identify icons show, the receive buffer size)
gets a JSDoc block with a `@guide` tag and a one-line description. A number that is a literal
in the code today becomes a named constant. The long-press time is MakeCode's (the DAL's
long-click event), not a firmware constant, so the guide states it by hand ("about a second").

### The generator

- Lives with the firmware build tooling in `scripts/spikerbit-firmware/`.
- Parses `spikerbit-clue.ts` with the TypeScript compiler API, collecting each tagged
  constant: its tag, name, description and initializer.
- Gets each icon's 5×5 LED pattern from MakeCode's own definition of `IconNames`
  (`images.iconImage` in the pinned `pxt-microbit`'s `built/target.json`), not from a table
  we keep ourselves. An icon it can't find is an error.
- Writes one SVG per display, a picture of a micro:bit with that pattern lit, into an images
  folder next to the guide.
- Rewrites only the text between marker comments in the guide, such as
  `<!-- generated: displays -->` … `<!-- end generated -->`. Everything outside the markers is
  left alone. A missing marker is an error.
- Fails, rather than writing a partial guide, on any error.

### Running and checking it

- `npm run build:firmware` regenerates the guide and its images along with the hex.
- `npm run check:firmware`, and so the `CI Firmware` workflow, fails when the committed guide
  or images differ from what the generator produces, just as it fails for the hex. Its path
  filter already covers `src/plugins/dataflow/firmware/**`. The workflow's stale-source step
  gets a companion that checks that a hand-edited generated section fails.
- The tag parsing and marker replacement have unit tests in the normal Jest suite, which runs
  without the MakeCode toolchain.

## Constraints

- No Jira ids in the guide, the README, `serial-protocols.md`, code comments or test names.
- US spelling.
- The firmware source changes (comments and constants), so the builder rebuilds the hex
  locally with `npm run build:firmware` and commits it with the source, and
  `spikerbit-firmware-consistency.test.ts` and the firmware CI check must pass. Behavior
  doesn't change, so no bench run is needed beyond confirming the bench script still passes if
  a board is at hand. Turning a literal into a named constant is in scope; changing a value is
  not.
- **The generator's output is deterministic:** the same source and toolchain give the same
  bytes on any machine (stable attribute order, ids and number formatting). `build.mjs`
  renders each picture twice in one process and throws if the two differ. The check compares
  bytes exactly. If `MicrobitBoardSvg` doesn't give byte-identical output, **stop and bring the
  options back to Scott** rather than picking one.
  The options known so far:
  - **Normalize the SVGs** with a minimizer (such as SVGO) that strips what varies between runs,
    and commit the normalized output. This is the one to try first.
  - **Draw a simple board ourselves,** which is deterministic by construction.
  - **Don't commit the generated guide:** build it locally and in CI, and deploy the guide
    and its images to S3. This is the last resort, because the guide is then no longer readable
    in the repository, which makes the repository harder to work with.
- The firmware still runs in `MakeCodeSim` (`src/models/stores/spikerbit-sim/makecode-sim.ts`);
  any new MakeCode API it uses needs a fake there.
- The SVGs must read clearly on GitHub in both light and dark themes.
- Links into `serial-protocols.md` (from `serial.md`, the firmware header comment, the README
  and the spec) point at sections it has.
- After this lands on `CLUE-728-protocol-firmware`, that branch is merged into
  `CLUE-728-spikerbit-firmware-status` (#3055) again, as before; #3055 also edits these docs,
  so expect conflicts there. They are resolved at that merge; the edits here aren't shaped to
  avoid them.

## Left to the builder

- **How to run the picture code.** Use MakeCode's `MicrobitBoardSvg` from the pinned
  `pxt-microbit`'s `built/sim.js`, under jsdom, so the board looks like MakeCode's simulator.
  If it can't run without a browser, or isn't deterministic (see Constraints), stop and bring
  the options back rather than falling back on your own.
- The guide's file name and the images folder's name (the controller's suggestion:
  `src/plugins/dataflow/firmware/user-guide.md` and `firmware/guide-images/`).
- The exact marker syntax, the generated table layouts, and the `@guide` constant names.
- Whether the generator is part of `build.mjs` or its own module that `build.mjs` calls.
- Where the unit-tested parsing code lives so that both Jest and the build can load it. Note
  that the root Jest config ignores `/scripts/spikerbit-firmware/`, and that `build:firmware`
  installs that folder with `npm ci`, so any dependency the generator adds there goes in its
  `package.json` and lockfile.
- Fixing the wrong example checksum in one firmware comment (`*0B` should be `*56`), since the
  source and hex change anyway. This is the controller's call.

## What a spike found (2026-10-24)

A throwaway script showed that the picture approach works on macOS with the repo's jsdom
(26.1.0) and the pinned toolchain:

- Load `pxt-core/built/pxtsim.js`, then `pxt-microbit/built/common-sim.js`, then
  `pxt-microbit/built/sim.js`, into a `JSDOM` window with `runScripts: "outside-only"`, using
  `window.eval` on each file's text.
- Construct `new pxsim.visuals.MicrobitBoardSvg({ theme: pxsim.visuals.themes[0] })`, with no
  `runtime`. Pass a fixed theme; `randomTheme` uses `Math.random`.
- Light each LED the way `updateLEDMatrix` does, through the board's `leds` array: `opacity`
  `1` for on and `0` for off, plus the `transform-box`, `transform-origin` and `scale(1)`
  styles for the lit ones.
- Serialize with `new window.XMLSerializer().serializeToString(board.element)`. `outerHTML`
  leaves out `xmlns`, so the file won't render as an image.
- Two runs in separate processes gave byte-identical files of about 32 KB.
- **The file has no dates or times.** Its numbers have one or two decimal places, except one
  floating-point artifact, `222.60000000000002`, which appears four times (the buttons' lower
  nuts). It comes from adding two decimals. ECMAScript specifies the result of addition and
  number-to-string conversion exactly, so it's the same on any platform. The drawing code calls
  no trig or `pow`, whose results can vary by platform; those appear only in its event and tilt
  handlers, which don't run without a runtime.
- A preview showed the V1-style board, with a cyan accent and the `Asleep` pattern lit
  correctly.

The first `CI Firmware` run of the finished check (2026-10-24) showed the same bytes on Linux:
the SVGs generated there matched the ones committed from macOS.
