# arduino

This directory contains arduino files for testing, development, and use with Backyard Brains materials.

`ccemgfsr.ino` is the sketch that must be running on an Arduino in order to work with Dataflow and   communicate with Backyard Brains hardware.  ⚠️ _This file needs to maintain this name and path on the master branch, as a link to it is published in printed materials._

Each `.ino` file is in its own directory.  This is a requirement of the Visual Studio Code arduino plugin, which allows us to manage our development hardware and arduino sketches within vsc, and track changes in the same version control context.

## files

### `bbgripper.ino`

is the original Backyard Brains sketch that, with the Muscle Spiker Shield, allows a user to control the Backyard Claw directly with an EMG sensor.  All control is on the Arduino.

### `ccemgfsr.ino`

Passes distinguishable streams of data down a single serial line, and can be used to control output within Dataflow (e.g. turning on a lightbulb).  Each sensor reading is output like this:

- reading from emg sensor: `emg:123\r\n`
- reading from fsr sensor: `fsr:2\r\n`

These arrive in Dataflow in non-uniform, unpredictable, rebracketed utterances, e.g.

`emg:1`
`23\r`
`\nfsr:2\r\n`

and are pieced back together by the `SerialDevice` object within Dataflow.