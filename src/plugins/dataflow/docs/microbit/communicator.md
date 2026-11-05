# Communicator

The program for the micro:bit attached to the computer
- It takes data received from the hub and sends it to the computer via serial.
- It takes data received from the computer and sends it to the hub via radio.
- You can toggle this on and off by pressing the A and B buttons.


```js
/**
 * micro:bit + Dataflow: "Communicator"
 * This is the basic program for the "Communicator"
 * micro:bit physically attached to the computer.
 */

let mode = 0
let readFromSerial = ""

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
        const signalType = receivedString.substr(0, 1)
        if (signalType == "s" || signalType == "r") {
            serial.writeLine(receivedString)
        }
    }
})

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    readFromSerial = serial.readLine()
    radio.sendString(readFromSerial)
})

```
