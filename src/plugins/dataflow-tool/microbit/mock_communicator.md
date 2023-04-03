# Mock Communicator

```js
/**
 * micro:bit + Dataflow: "Mock Communicator"
 *
 * This is a program for the micro:bit physically attached to the computer, used for development on the dataflow side.
 * This is designed to mock output from the communicator micro:bit in a world of radio networked sensor/actuator hubs
 *
 * [ A ] - mode 1 - "on" : pass a stream of mock messages to serial (dataflow)
 *
 *  (name: sat, value: 20.4)     sat20.2      "the temperature reading on microbit a is 20.2 degrees"
 *  (name: sbt, value: 17.32)    sbt17.32     "the temperature reading on microbit b is 17.32 degrees"
 *  (name: sah, value: 40)       sah40        "the humidity reading on microbit a is 40 percent"
 *  (name: rb1, value: 1)        rb1          "the state of relays on microbit b is relayStates[1]"
 * [ B ] - mode 0 - "off": dont' send any mock messages
 */

// eight possible relay states we can encode it as a single digit, and an array to fetch value

//  0    1    2    3    4    5    6    7
// [000, 001, 010, 011, 100, 101, 110, 111]
//


// above should work

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
    { name: "sat", value: 10.4 },  // temp a rises
    { name: "sat", value: 10.5 },
    { name: "sat", value: 10.6 },
    { name: "sbt", value: 11.32 }, // temb b falls
    { name: "sbt", value: 11.22 },
    { name: "sbt", value: 11.12 },
    { name: "sah", value: 40 },
    { name: "sah", value: 20 },
    { name: "sah", value: 10 },
    { name: "ra2", value: 1 },  // relay A2 on, then off
    { name: "ra2", value: 0 },
    { name: "ra1", value: 0 },  // relay A1 off, then on
    { name: "rb1", value: 1 }
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

function sendStreamMessage(name: string, value: number) {
    if (mode == 1) {
        // send with :
        // serial.writeValue(name, value)

        // send without :
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