# CLUE-729: Build the Spiker:bit firmware hex from source — design

## 1. Problem

The DataFlow tile flashes `src/plugins/dataflow/firmware/spikerbit-clue.hex` onto a
micro:bit over WebUSB. That hex is built by hand: someone pastes `spikerbit-clue.ts` into
<https://makecode.microbit.org>, exports a universal hex and commits it. Nothing checks that
the committed hex was built from the committed source. The `spikerbit-firmware-consistency`
Jest test only checks that the version string `CLUE-SPIKERBIT v<N>` appears in the hex.

The drift has already happened. A MakeCode hex embeds the project's source
(LZMA-compressed, after the program image). The `main.ts` embedded in the committed hex
still contains the servo-pin `NOTE:` comment that a later commit removed from
`spikerbit-clue.ts`. The difference is comment-only, so behavior is unaffected, but it is
exactly the mismatch the current test cannot see.

CLUE-728 and CLUE-715 both change this firmware, so it will be rebuilt several times in the
coming sprints.

## 2. Goals

- `npm run build:firmware` compiles `spikerbit-clue.ts` into `spikerbit-clue.hex` with a
  pinned MakeCode toolchain, so the build is reproducible.
- The built hex stays committed. The app build, `npm install` and the existing CI jobs do not
  need the MakeCode toolchain.
- A Jest test fails when the source embedded in the hex differs from `spikerbit-clue.ts`.
- If the build is deterministic, a CI job rebuilds the hex and fails when it differs from the
  committed file.
- The firmware README describes the new rebuild steps.

**Out of scope:** upgrading MakeCode past the pinned version; dropping the `radio` and
`microphone` dependencies the website adds to new projects; building the bench-test
programs (`spikerbit-emg-test.ts`, `spikerbit-envelope-test.ts`), which stay
paste-into-MakeCode; any firmware behavior change (CLUE-728, CLUE-715); automating the
version bump.

## 3. What the committed hex tells us

Decoding the committed hex gives:

- **Universal hex.** It has Intel HEX record types `0A`, `0C`, `0D` and `0E` (block start,
  padding, custom data, other data), i.e. a combined V1+V2 file.
- **Toolchain versions.** The source-embed metadata records
  `{"eURL":"https://makecode.microbit.org/","eVER":"9.0.5","pxtTarget":"microbit"}`, and the
  embedded project header records `targetVersions` `{"target":"9.0.5","pxt":"13.0.4"}`.
  Both `pxt-microbit@9.0.5` and `pxt-core@13.0.4` are published on npm.
- **No timestamps.** The embedded header holds only `name`, `comment`, `status`, `cloudId`,
  `editor` and `targetVersions`. Nothing in it changes between two exports of the same source,
  which makes a deterministic build likely.
- **Embedded files.** `main.ts` (the program), `pxt.json`, `main.blocks` (the default
  empty-template stub: an `on start` block and a `forever` block) and an empty `README.md`.
  `pxt.json` lists dependencies `core`, `radio` and `microphone`.
- **Precompiled native images.** The `pxt-microbit@9.0.5` npm package ships
  `built/hexcache/*.hex`. A program that only uses MakeCode TypeScript and the bundled
  libraries should link against these without compiling C++, so no Docker or cloud compile
  should be needed.

## 4. Approach

Pin `pxt-core` and `pxt-microbit` from npm and run `pxt build`.

Alternatives considered:

- **The `makecode` (mkc) CLI.** It is lighter to install, but it downloads the compiler from
  the live MakeCode website at build time. Pinning then depends on versioned editor URLs and
  mkc's cache instead of a lockfile, and the build breaks if that URL moves.
- **Docker around either toolchain.** Only useful if the build needs a native C++ compile. It
  would put Docker on developer machines and in CI for no benefit otherwise. It is the
  fallback if the feasibility check (§6) shows the npm build cannot work offline.

The pins start at the versions that built the committed hex (9.0.5 / 13.0.4), so the first
CLI build can be compared byte for byte with it. Moving to a newer MakeCode is a separate
change that needs a bench test on real hardware.

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

Extend `src/models/stores/spikerbit-firmware-consistency.test.ts` with a test that:

1. Decodes the hex's data records (types `00`, `0D`, `0E`).
2. Finds the source-embed magic `41 14 0E 2F B8 2F A2 BB` and parses the JSON metadata after
   it (`compression`, `headerSize`, `textSize`, ...).
3. LZMA-decompresses the payload, skips `headerSize` bytes of project header, parses the file
   map, and asserts its `main.ts` equals the contents of `spikerbit-clue.ts`.

Node has no LZMA decoder, so this adds the pure-JS `lzma` package and `@types/lzma` as root
devDependencies.
The test runs in the existing `jest` CI job with no toolchain.

Against today's committed hex this test fails (the `NOTE:` comment), which is the drift in §1.
It passes once the hex is regenerated (§6, step 4).

Rewrite the test's `LIMITATION` comment: the Jest tests check that the version and the
embedded source match, and the CI rebuild (§5.4) checks the compiled program. If the CI
rebuild is dropped (§6, step 2), say instead that nothing checks the compiled program
against the embedded source.

### 5.4 CI job: rebuild and diff

A new workflow, `.github/workflows/firmware.yml`, following the path-filtered pattern of
`functions-v2.yml`:

- **Trigger:** `push` with `paths` `src/plugins/dataflow/firmware/**`,
  `scripts/spikerbit-firmware/**` and `.github/workflows/firmware.yml`. Changes to the
  bench-test programs also trigger it, which is harmless.
- **Steps:** checkout; `actions/setup-node` with Node 20 (the version `ci.yml` uses) and npm
  caching keyed on `scripts/spikerbit-firmware/package-lock.json`; `npm ci` and
  `npm run check` in `scripts/spikerbit-firmware`. A last step appends a line to the source
  and expects `npm run check` to fail, so a check that can't fail is caught.
- **Hardening:** `permissions: contents: read`, `persist-credentials: false` on checkout (the
  job runs third-party install scripts), and `timeout-minutes: 15`.

This job is added only if the feasibility check finds the build deterministic.

### 5.5 Documentation

Rewrite "Rebuilding the hex" in `src/plugins/dataflow/firmware/README.md`:

1. Edit `spikerbit-clue.ts`.
2. If behavior changed, bump `VERSION` there and `kSpikerbitFirmwareVersion` in
   `src/models/stores/spikerbit-device.ts`.
3. Run `npm run build:firmware`.
4. Commit the source and the hex together. The Jest test and the CI job fail if they differ.

Also cover:

- **Upgrading MakeCode.** Bump `pxt-core` and `pxt-microbit` together, rebuild, and bench
  test on real hardware.
- **Prototyping in the web editor.** Importing `spikerbit-clue.hex` into MakeCode opens its
  embedded source. Copy any changes back into `spikerbit-clue.ts` and rebuild with the script;
  don't commit a hex exported from the website.
- Remove the note saying the hex is a hand-built binary and not a reproducible build.

## 6. Implementation order and feasibility gate

1. **Reproduce the committed hex.** Install the pinned packages and build the source embedded
   in the committed hex (the version of `spikerbit-clue.ts` from before the `NOTE:` removal).
   Compare the result byte for byte with the committed hex.
   - Identical: the CLI reproduces a website export.
   - Different: locate the differing records. A difference confined to the source-embed block
     is acceptable as long as CLI builds agree with each other (step 2). A difference in the
     program image means the CLI build is not equivalent to the website build: stop and
     revisit the design.
2. **Determinism.** Build twice on macOS and once on Linux in a CI run, and diff the three
   outputs. If they differ, drop the CI job (§5.4), keep the Jest check, and say in the README
   why there is no CI rebuild.
3. **Stop and revisit** if the build needs a native compile (no matching `hexcache` entry) or
   fetches anything from the network beyond what `npm ci` installed.
4. **Regenerate the hex** from the current `spikerbit-clue.ts` and commit it. The source
   change since the last export is a comment, so the program image (everything outside the
   source-embed block) must be byte-identical to the previous hex. Verify that. If it holds,
   firmware behavior is unchanged and no bench test is needed.
5. Add the Jest check, the CI job, the root scripts and the README changes.

## 7. Testing

- **Jest:** the new embedded-source test, which fails on the old hex and passes on the
  regenerated one. The existing version tests are unchanged.
- **CI job:** passes on the branch. To show it can fail, push a throwaway branch that edits
  `spikerbit-clue.ts` without rebuilding, confirm the job fails with the "run
  `npm run build:firmware`" message, then delete the branch. Mention that run in the PR
  description. The job's last step repeats this check on every run.
- **Build script:** run `npm run build:firmware` and `npm run check:firmware` locally on a
  clean checkout; `check` passes, and `build` leaves `git status` clean.
- No Cypress tests; nothing in the app changes.

## 8. Risks

- **`pxt build` may not behave as described offline.** The feasibility gate (§6) catches this
  before anything else is built. Fallbacks are Docker or the mkc CLI, decided then.
- **pxt-core on Node 20/22/24.** `pxt-core@13.0.4` declares `node >= 18`, so all three
  supported Node versions should work; the CI job uses Node 20.
- **Toolchain install size and time.** Only the firmware workflow and developers who run
  `build:firmware` pay it; the main CI jobs and `npm install` are unaffected.
