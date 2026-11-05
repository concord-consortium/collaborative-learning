# Mock Communicator

```js
/**
 * micro:bit + Dataflow: "Mock Communicator"
 *
 * This is a program for the micro:bit physically attached to the computer, used for development on the dataflow side.
 * This is designed to mock output from the communicator micro:bit that connects to a world of radio networked sensor/actuator hubs
 * Readings begin as numbers and strings are are concatenated before sending to serial
 *
 *  (name: sat, value: 20.4)     sat20.2      "the temperature reading on microbit a is 20.2 degrees"
 *  (name: sbt, value: 17.32)    sbt17.32     "the temperature reading on microbit b is 17.32 degrees"
 *  (name: sah, value: 40)       sah40        "the humidity reading on microbit a is 40 percent"
 *  (name: sar, value: "010")    sar010       "the state of relays on microbit a is [off, on, off]"
 *
 * [ A ] - on - send mock messages
 * [ B ] - off - don't send messages
 */

let mode = 0
let mIndex = 0


function turnOn() {
    mode = 1
    basic.showIcon(IconNames.Happy)
}

function turnOff() {
    mode = 0
    basic.showIcon(IconNames.Asleep)
}

let messageObjects = [
    { name: "sar", value: "000" }, // relays on a: off, off, off
    { name: "sat", value: 10.4 },  // temp a rising...
    { name: "sat", value: 10.5 },
    { name: "sat", value: 10.6 },
    { name: "sbt", value: 11.32 }, // temb b falling...
    { name: "sbt", value: 11.22 },
    { name: "sbt", value: 11.12 },
    { name: "sar", value: "010" }, // relays on a: off, on, off
    { name: "sah", value: 40 },    // humididty a falling...
    { name: "sah", value: 20 },
    { name: "sah", value: 10 },

]

function startUp() {
    serial.redirect(
        SerialPin.USB_TX,
        SerialPin.USB_RX,
        BaudRate.BaudRate9600
    )
    mode = 0
    mIndex = 0
    basic.showIcon(IconNames.Asleep)
}

function nextIndex() {
    mIndex = mIndex + 1;
    if (mIndex > messageObjects.length - 1) {
        mIndex = 0
    }
}

function sendStreamMessage(name: string, value: string | number) {
    if (mode == 1) {
        serial.writeLine(`${name}${value}`)
    }
}

startUp()

input.onButtonPressed(Button.A, function () { turnOn() })
input.onButtonPressed(Button.B, function () { turnOff() })

basic.forever(function () {
    if (mode == 1) {
        nextIndex()
        for (let i = 0; i < 6; i++) {
            sendStreamMessage(messageObjects[mIndex].name, messageObjects[mIndex].value)
        }

    } else {
        basic.showIcon(IconNames.Asleep)
    }
})
```