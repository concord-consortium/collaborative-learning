# Spiker:bit protocol bench

A Node script that talks to a real Spiker:bit over its USB serial port and checks the firmware's
replies to every CC Device Protocol command. It checks replies
only. It can't see sensors, the display, sound or the servo, so those checks stay with a person.

## Running

```bash
npm run bench:spikerbit -- [--port <path>] [--flash]
```

- `--port <path>`: the serial device. Without it, the script uses the only `/dev/cu.usbmodem*`;
  zero or several is an error that names what it found.
- `--flash`: first flashes `src/plugins/dataflow/firmware/spikerbit-clue.hex` by running
  `cp -X` to `/Volumes/MICROBIT/` as a child process, waits 10 s for the board to reprogram, then
  retries `?` for up to 30 s until the board answers. A `FAIL.TXT` on the drive afterward is
  reported and fails the run. The script never reads the drive itself, because file calls on it
  can block while the board reprograms. If the copy hasn't finished after 30 s the script says
  "flash copy is stuck; unplug and replug the board" and exits 1.

The first thing it does is send `?`. If the board answers with the old `CLUE-SPIKERBIT v<N>`
banner, the script stops with "running v<N> firmware; rerun with --flash".

Each check prints `PASS` or `FAIL` and its name; a failure also shows what was sent and what came
back. The exit code is 0 when every check passes and 1 otherwise. The checks are the array
returned by `buildChecks` in `bench.mjs`. The script ends with `close` so the board is left idle.

## Notes

- Only one program can hold the serial port. Close Dataflow's connection (or the browser tab)
  before running the script, and disconnect the script before using Dataflow.
- A run takes about 10 s. Don't touch the board's buttons while it runs.
- Claude Code's sandbox may block access to the serial device and to `/Volumes`; the script may
  need to be run outside the sandbox.
