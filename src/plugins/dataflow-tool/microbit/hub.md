# Hub

The program for the micro:bit attached to the sensors/relays

Downloadable link: https://makecode.microbit.org/_YpoCfzeTwCWP

#### Outgoing strings to write,
e.g. : `sat20.31`
- `s`: "signal"
- `a`: "hub A"
- `t`: "temperature reading" (or `h` for humidity, or `r` for relays state),
- `<n>`: the reading as a string of num chars

#### Incoming strings to read
e.g. : `ca11`
- `c`: "control"
- `a`: "hub A"
- `1`: "relay at index 1"
- `1`: "turn on"

#### Pins
- `15`    dht sensor (should change to `16`?):
- `8`     relay 2 (sprinkler) (green)
- `9`     relay 1 (fan) (yellow)
- `12`    relay 0 (heat) (red)

```js
radio.setGroup(1)

let hubIds = ['x', 'a', 'b', 'c', 'd']
let hubI = 0

// pins chosen based on https://makecode.microbit.org/device/pins
// relays       0 Heat           1 Fan          2 Sprinkler
let relayPins = [DigitalPin.P12, DigitalPin.P9, DigitalPin.P8]
let relayStates = [0, 0, 0]

function getTempString() {
    const t = Math.constrain(dht11_dht22.readData(dataType.temperature), 0, 100);
    return `s${hubIds[hubI]}t${t}`;
}

function getHumidString() {
    const h = Math.constrain(dht11_dht22.readData(dataType.humidity), 0, 100);
    return `s${hubIds[hubI]}h${h}`;
}

function readSendData() {
    dht11_dht22.queryData(DHTtype.DHT11, DigitalPin.P15, false, false, false)
    radio.sendString(getTempString())
    pause(1000) //readings improve with this delay
    radio.sendString(getHumidString())
}

function operateRelay(relayIndex: number, state: number) {
    const validRelay = relayIndex === 0 || relayIndex === 1 || relayIndex === 2;
    const validRelaySignal = state === 0 || state === 1;
    if (validRelay && validRelaySignal){
        pins.digitalWritePin(relayPins[relayIndex], state)
        relayStates[relayIndex] = state
        sendAggregatedRelayState();
    }

    // show one of three LEDs to indicate index 0, 1, or 2
    led.plot(relayIndex, 0)

    if (state == 1) {
        // show a check mark for "on"
        led.plot(1, 3)
        led.plot(3, 3)
        led.plot(2, 4)
        led.plot(4, 2)
    } else {
        // show an x for "off"
        led.plot(2, 2)
        led.plot(3, 3)
        led.plot(4, 4)
        led.plot(2, 4)
        led.plot(4, 2)
    }
}

function sendAggregatedRelayState(){
    const relayStateString = `s${hubIds[hubI]}r${relayStates.join('')}`;
    radio.sendString(relayStateString);
}

basic.forever(function () {
    basic.showString(hubIds[hubI])
    if (hubI > 0) {
        pause(2000) // minumum required delay
        readSendData()
    }
})

input.onButtonPressed(Button.A, () => {
    if (hubI > 0) hubI--;
})

input.onButtonPressed(Button.B, () => {
    if (hubI < 4) hubI++;
})

radio.onReceivedString(function (receivedString) {
    const messageType = receivedString.charAt(0);
    const addressedTo = receivedString.charAt(1);
    const ri = parseInt(receivedString.charAt(2));
    const data = parseInt(receivedString.charAt(3));
    if (messageType == "c" && addressedTo == hubIds[hubI]) {
        basic.clearScreen()
        operateRelay(ri, data)
    } else {
        basic.clearScreen()
        basic.showString(hubIds[hubI])
    }
})

```