# Hub

The program for the micro:bit attached to the sensors/relays

Every two seconds
  - Get a temp reading
  - Get a humidity reading
  - Make a packet for temp
  - Make a packet for humidity
  - Send temp packet
  - Send humidity packet


On radio recieved
  - If message type == `c` and addressed to my id
  - Change relay states accordingly
  - Send confirmation of relay states back as an `s`


```js
radio.setGroup(1)

let hubIds = ['x', 'a', 'b', 'c', 'd']
let hubI = 0

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
    pause(1000)
    radio.sendString(getHumidString())
}

basic.forever(function () {
    basic.showString(hubIds[hubI])
    if (hubI > 0) {
        pause(2000)
        readSendData()
    }
})

input.onButtonPressed(Button.A, () => {
    if (hubI > 0) hubI--;
})

input.onButtonPressed(Button.B, () => {
    if (hubI < 4) hubI++;
})

// works
radio.onReceivedString(function (receivedString) {
    const messageType = receivedString.charAt(0)
    const targetHub = receivedString.charAt(1)

    basic.showString(receivedString)
})

```