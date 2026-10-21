# CLUE-729: Build the Spiker:bit firmware hex from source — design

## 1. Problem

The DataFlow tile flashes `src/plugins/dataflow/firmware/spikerbit-clue.hex` onto a
micro:bit over WebUSB. That hex was built by hand: someone pasted `spikerbit-clue.ts` into
<https://makecode.microbit.org>, exported a universal hex and committed it. Nothing checked
that the committed hex was built from the committed source. The `spikerbit-firmware-consistency`
Jest test only checked that the version string `CLUE-SPIKERBIT v<N>` appeared in the hex.

The drift had already happened. A MakeCode hex embeds the project's source
(LZMA-compressed, after the program image). The `main.ts` embedded in the hand-exported hex
still contained the servo-pin `NOTE:` comment that a later commit removed from
`spikerbit-clue.ts`. The difference was comment-only, so behavior was unaffected, but it was
exactly the mismatch the test could not see.

CLUE-728 and CLUE-715 both change this firmware, so it will be rebuilt several times in the
coming sprints.

## 2. Goals

- `npm run build:firmware` compiles `spikerbit-clue.ts` into `spikerbit-clue.hex` with a
  pinned MakeCode toolchain, so the build is reproducible.
- The built hex stays committed. The app build, `npm install` and the existing CI jobs do not
  need the MakeCode toolchain.
- A Jest test fails when the source embedded in the hex differs from `spikerbit-clue.ts`.
- A CI job rebuilds the hex and fails when it differs from the committed file.
- The firmware README describes the rebuild steps.

**Out of scope:** upgrading MakeCode past the pinned version; dropping the `radio` and
`microphone` dependencies the website adds to new projects; building the bench-test
programs (`spikerbit-emg-test.ts`, `spikerbit-envelope-test.ts`), which stay
paste-into-MakeCode; any firmware behavior change (CLUE-728, CLUE-715); automating the
version bump.

## 3. What the hand-exported hex showed

Decoding the hand-exported hex gave:

- **Universal hex.** It had Intel HEX record types `0A`, `0C`, `0D` and `0E` (block start,
  padding, custom data, other data), i.e. a combined V1+V2 file.
- **Toolchain versions.** The source-embed metadata recorded
  `{"eURL":"https://makecode.microbit.org/","eVER":"9.0.5","pxtTarget":"microbit"}`, and the
  embedded project header recorded `targetVersions` `{"target":"9.0.5","pxt":"13.0.4"}`.
  Both `pxt-microbit@9.0.5` and `pxt-core@13.0.4` are published on npm.
- **No timestamps.** The embedded header held only `name`, `comment`, `status`, `cloudId`,
  `editor` and `targetVersions`, so nothing in it would change between two exports of the same
  source. That made a deterministic build likely.
- **Embedded files.** `main.ts` (the program), `pxt.json`, `main.blocks` (the default
  empty-template stub: an `on start` block and a `forever` block) and an empty `README.md`.
  `pxt.json` listed dependencies `core`, `radio` and `microphone`.
- **Precompiled native images.** The `pxt-microbit@9.0.5` npm package ships
  `built/hexcache/*.hex`. A program that only uses MakeCode TypeScript and the bundled
  libraries could link against these without compiling C++, so no Docker or cloud compile
  looked necessary.

## 4. Approach

Pin `pxt-core` and `pxt-microbit` from npm and run `pxt build`.

Alternatives considered:

- **The `makecode` (mkc) CLI.** It is lighter to install, but it downloads the compiler from
  the live MakeCode website at build time. Pinning then depends on versioned editor URLs and
  mkc's cache instead of a lockfile, and the build breaks if that URL moves.
- **Docker around either toolchain.** Only useful if the build needs a native C++ compile. It
  would put Docker on developer machines and in CI for no benefit otherwise. It was the
  fallback in case the npm build couldn't work offline, which §6 shows it can.

The pins are the versions that built the hand-exported hex (9.0.5 / 13.0.4), so the CLI build
could be compared byte for byte with it. Moving to a newer MakeCode is a separate change that
needs a bench test on real hardware.

## 5. Design

### 5.1 Tooling package: `scripts/spikerbit-firmware/`

A self-contained package, like `firebase-test/` and `scripts/ai-harness/`. It has its own
`package.json` and `package-lock.json`, so the root `npm install` does not install the
toolchain.

- **`package.json`** pins `pxt-core` and `pxt-microbit` to exact versions (no `^`/`~`).
- **`project/pxt.json`** is the project template: name `spikerbit-clue`, dependencies
  `core`, `radio`, `microphone`, files `main.ts` only, and `preferredEditor` `tsprj`. It has
  no `targetVersions` block: pxt fills one in from the pinned target's `built/target.json`. A
  future firmware that needs an extension adds it here.
- **`pxt.cjs`** runs the pxt command line against the pinned target by passing its directory
  to `pxt-core`'s `mainCli`. The usual `pxt` command finds the target by searching up for a
  `node_modules/pxtcli.json`, which a temporary project doesn't have. pxt runs in its own
  process because it works on the current directory and exits the process itself when a
  build fails.
- **`.puppeteerrc.cjs`** skips the Chrome download that `pxt-core`'s puppeteer dependency
  would otherwise do on install; the build never starts a browser.
- **`build.mjs`** does the build:
  1. Create a temporary directory holding `pxt.json` from the template and
     `spikerbit-clue.ts` copied as `main.ts`. A website export also has a stub `main.blocks`
     and an empty `README.md`; the build leaves them out, since the hex embeds every project
     file and MakeCode doesn't need them. Importing the hex into the MakeCode editor opens the
     source in JavaScript, without a Blocks toggle.
  2. Run `pxt build --install` there through `pxt.cjs`, which installs the dependencies and
     builds in one step. It writes the universal (V1+V2) hex as `built/binary.hex`.
  3. Default mode: copy the result to `src/plugins/dataflow/firmware/spikerbit-clue.hex`.
     `--check` mode: compare the result with the committed hex and write nothing. On a
     mismatch, exit nonzero with a message telling the developer to run
     `npm run build:firmware` and commit the result.
  4. Remove the temporary directory.

### 5.2 Root scripts

```json
"build:firmware": "npm --prefix scripts/spikerbit-firmware ci && npm --prefix scripts/spikerbit-firmware run build",
"check:firmware": "npm --prefix scripts/spikerbit-firmware ci && npm --prefix scripts/spikerbit-firmware run check"
```

`spikerbit-clue.ts` stays the source of record under its current name. The firmware
directory stays excluded from `tsconfig.json` and `.eslintrc.js`.

### 5.3 Jest check: embedded source matches `spikerbit-clue.ts`

`src/models/stores/spikerbit-firmware-consistency.test.ts` has a test that:

1. Decodes the hex's data records (types `00`, `0D`, `0E`).
2. Finds the source-embed magic `41 14 0E 2F B8 2F A2 BB` and parses the JSON metadata after
   it (`compression`, `headerSize`, `textSize`, ...).
3. LZMA-decompresses the payload, skips `headerSize` characters of project header, parses the
   file map, and asserts its `main.ts` equals the contents of `spikerbit-clue.ts`.

Node has no LZMA decoder, so the root package has the pure-JS `lzma` package and `@types/lzma`
as devDependencies. The test runs in the existing `jest` CI job with no toolchain.

The test file's header says what each check covers: the Jest tests check the version and the
embedded source, and the `CI Firmware` workflow (§5.4) checks the compiled program.

### 5.4 CI job: rebuild and diff

A workflow, `.github/workflows/firmware.yml`. It relies on the build being deterministic,
which §6 confirmed.

- **Trigger:** `pull_request` with `paths` `src/plugins/dataflow/firmware/**`,
  `scripts/spikerbit-firmware/**` and `.github/workflows/firmware.yml`, for pull requests
  into any branch. The path filter compares the whole pull request with its base, so every
  new head of a pull request that touches the firmware gets the check. A `push` filter only
  looks at what one push changed, so a later push that didn't touch the firmware would leave
  the head without the check, and an earlier failure would drop off the pull request.
  Changes to the bench-test programs also trigger it, which is harmless.
- **Also `push` to `master`,** with the same paths. Two pull requests can each pass and still
  leave a stale hex once both are merged, for example one that rebuilt the hex from new
  source while the other bumped the toolchain pins. A run on master after the merge catches
  that. A long-running branch with its own pull request into master is covered by that pull
  request's runs: each merge into the branch moves its head and runs the check again.
- **Steps:** checkout; `actions/setup-node` with Node 20 (the version `ci.yml` uses) and npm
  caching keyed on `scripts/spikerbit-firmware/package-lock.json`; `npm ci` and
  `npm run check` in `scripts/spikerbit-firmware`. A last step appends a line to the source
  and expects `npm run check` to fail, so a check that can't fail is caught.
- **Hardening:** `permissions: contents: read`, `persist-credentials: false` on checkout (the
  job runs third-party install scripts), and `timeout-minutes: 15`.

### 5.5 Documentation

The "Rebuilding the hex" section of `src/plugins/dataflow/firmware/README.md` gives the steps:

1. Edit `spikerbit-clue.ts`.
2. If behavior changed, bump `VERSION` there and `kSpikerbitFirmwareVersion` in
   `src/models/stores/spikerbit-device.ts`.
3. Run `npm run build:firmware`.
4. Commit the source and the hex together. The Jest test and the CI job fail if they differ.

It also covers:

- **Upgrading MakeCode.** Bump `pxt-core` and `pxt-microbit` together, rebuild, and bench
  test on real hardware.
- **Prototyping in the web editor.** Importing `spikerbit-clue.hex` into MakeCode opens its
  embedded source. Copy any changes back into `spikerbit-clue.ts` and rebuild with the script;
  don't commit a hex exported from the website.

## 6. What was checked before settling the design

This story started as an investigation of whether the hex could be built reproducibly in the
repo. These checks answered it, and the design above rests on them.

1. **The CLI build matches a website export.** With the pinned packages, building the source
   embedded in the hand-exported hex, together with that export's `pxt.json`, `main.blocks` and
   empty `README.md`, gave a hex identical to the hand-exported one, byte for byte.
2. **The build is deterministic.** The hex built on macOS (Node 24) and the one built in CI on
   Linux (Node 20) were identical, byte for byte.
3. **It needs no native compile and no network.** The precompiled `hexcache` images covered
   the program, and the build ran with networking blocked once `npm ci` had installed the
   packages.
4. **Regenerating the hex changed only the embedded source.** Building the current
   `spikerbit-clue.ts`, whose only change since the export was the removed comment, left every
   program record (types `00` and `0D`) identical to the hand-exported hex; only the
   source-embed records (`0E`) and the padding after them changed. So firmware behavior was
   unchanged and no bench test was needed. The new Jest test failed against the hand-exported
   hex on the `NOTE:` comment and passed on the regenerated one.
5. **The project can be smaller than a website export.** Leaving out `main.blocks`,
   `README.md` and `targetVersions` changed only the embedded source again. Importing the
   result into the MakeCode v9.0.5 editor opened the source in JavaScript, and pxt filled in
   `targetVersions` itself.
6. **The CI check can fail.** A throwaway branch that edited `spikerbit-clue.ts` without
   rebuilding failed the job with the "run `npm run build:firmware`" message.

## 7. Testing

- **Jest:** `spikerbit-firmware-consistency.test.ts` checks that `VERSION` matches
  `kSpikerbitFirmwareVersion`, that the hex contains the version string, that the hex's
  embedded `main.ts` equals `spikerbit-clue.ts`, and that a hex with no embedded source fails
  with a clear message.
- **CI job:** rebuilds the hex and compares it with the committed one, then checks that a
  stale source fails.
- **Build script:** `npm run build:firmware` on a clean checkout leaves `git status` clean,
  and `npm run check:firmware` passes.
- No Cypress tests; nothing in the app changes.

## 8. Risks

- **Node versions.** `pxt-core@13.0.4` declares `node >= 18`. The build has run on Node 20 in
  CI and Node 24 locally.
- **Toolchain install size and time.** Only the firmware workflow and developers who run
  `build:firmware` pay it; the main CI jobs and `npm install` are unaffected.
