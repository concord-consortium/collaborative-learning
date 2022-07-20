# arduino

This directory contains arduino files for testing, development, and use with Backyard Brains materials.

The only file meant for use in the classroom is `universal.ino`

Each `.ino` file is in its own directory.  This is a requirement of the Visual Studio Code arduino plugin, which allows us to manage our development hardware and arduino sketches within vsc, and track changes in the same version control context.

## files

### `bbgripper.ino`

is the original Backyard Brains sketch that, with the Muscle Spiker Shield, allows a user to control the Backyard Claw directly with an EMG sensor.  All control is on the Arduino.

### `ccemgfsr.ino`

passes distinguishable streams of data down a single serial line, and can be used to control output within Dataflow (e.g. turning on a lightbulb).  Each sensor reading is output like this:

- reading from emg sensor: `emg123\r\n`
- reading from fsr sensor: `fsr2\r\n`

These arrive in Dataflow in non-uniform, unpredictable, rebracketed utterances, e.g.

`emg1`
`23\r`
`\nfsr2\r\n`

and are pieced back together by the `SerialDevice` object within Dataflow.



## development instructions

The Visual Studio code Arduino plugin keeps current configuration in a local file `.vscode/arduino.json` that it writes to as you make changes in the GUI (e.g. which program you intend to flash to your hardware).

When you open a `.ino` file in Visual Studio Code, and have the extension installed, you will see the interface on the top right.

In order to get things working, you'll need to write that file initially by clicking the verify sketch button.