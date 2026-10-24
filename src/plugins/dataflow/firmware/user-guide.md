# Spiker:bit firmware guide

What the Spiker:bit's micro:bit shows and the limits it works within.

## LED displays

<!-- generated: displays -->
<!-- Generated from spikerbit-clue.ts by npm run build:firmware. Edit the comments there, not this section. -->
| Display | When it shows |
| --- | --- |
| <img src="guide-images/display-waiting.svg" alt="Waiting icon" width="160"><br>**Waiting** | Shown at power-up, when a session ends, and when free-run stops. The board is idle and nothing has spoken to it since. |
| <img src="guide-images/display-found.svg" alt="Found icon" width="160"><br>**Found** | Shown after a `?` arrives while idle: a host has found the board but hasn't opened a session. If it stays, Dataflow's version check or flashing didn't finish. |
| <img src="guide-images/display-connected.svg" alt="Connected icon" width="160"><br>**Connected** | Shown for 3 seconds after `open` starts a session. The display is then cleared and stays blank for the rest of the session. |
| <img src="guide-images/display-identify.svg" alt="Identify icon" width="160"><br>**Identify** | Shown for 3 seconds after `identify`, in any state, along with a short sound on a micro:bit V2. The display then goes back to what the state calls for. |
| <img src="guide-images/display-streaming.svg" alt="Streaming icon" width="160"><br>**Streaming** | Shown in free-run, which `stream` or a long press of button A starts. |
<!-- end generated: displays -->

## Timing and limits

<!-- generated: values -->
<!-- Generated from spikerbit-clue.ts by npm run build:firmware. Edit the comments there, not this section. -->
| Setting | Value |
| --- | --- |
| How often a reading is sent, in a session or in free-run. | 100 ms |
| How long a session lasts without a `ping`, when `open` doesn't give a `timeout`. | 5,000 ms |
| The shortest `timeout` that `open` accepts. | 1,000 ms |
| The longest `timeout` that `open` accepts. | 60,000 ms |
| The largest session id; ids start at 1. | 65,535 |
| How long the connected and identify icons show. | 3,000 ms |
| The serial receive buffer, in characters. A longer line is cut off. | 128 |
<!-- end generated: values -->
