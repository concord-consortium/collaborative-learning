# Communicator

The program for the micro:bit attached to the computer

On received string via radio
  - assemble the string
  - write it to serial

On received command string via serial
  - broadcast it to targeted hub

```js
/**
 * micro:bit + Dataflow: "Communicator"
 * This is the basic program for the micro:bit physically attached to the computer.
 */

let mode = 0

radio.setGroup(1)
serial.redirect(
    SerialPin.USB_TX,
    SerialPin.USB_RX,
    BaudRate.BaudRate9600
)
basic.showIcon(IconNames.Asleep)

input.onButtonPressed(Button.A, function () {
    mode = 1
    basic.showIcon(IconNames.Happy)
})

input.onButtonPressed(Button.B, function () {
    mode = 0
    basic.showIcon(IconNames.Asleep)
})

radio.onReceivedString(function (receivedString) {
    if (mode == 1) {
        serial.writeLine(receivedString)
    }
})


```

