# serial connections to Dataflow

## Serial.ts

`serial.ts` is an object manages the current serial connection, and keeps track of information programs need to interact with the serial port.

```ts

  localBuffer: string;                       // we create our own buffer to scan and "chomp" off complete messages
  private port: SerialPort | null;           // points to browser instance of a serial port
  connectChangeStamp: number | null;         // the last time the connection status changed, see below
  lastConnectMessage: string | null;         // we track the last connection message
  deviceInfo: SerialPortInfo | null;         // vendor and device id are presented on connection, and we store here
  serialNodesCount: number;                  // we want to know how many nodes we have that need a serial connection
  writer: WritableStreamDefaultWriter;       // points to an instance browsers writing utility
  serialModalShown: boolean | null;          // we may not want to show the modal over and over
  deviceFamily: string | null;               // at the moment, we only need to know if it's an arduino or a micro:bit

```

`requestAndSetPort`
This is called whenever the connection is refreshed, (when the connect button is clicked).  This results in the browsers serial connection dialog, and gives us the opportunity to learn and store what device is connected, so we can run the correct code later on.

The filters commented out were set up so that only Arduino boards (and close-match non-Arduinos such as the DFRobot one) will show as options for users to connect.  It turns out that there are working Arduino clones that do not match these filters, one of which is being shipped with the latest generation of BB hardware. Rather than attempt to match every non-standard board, we are removing the filters for now and adding a message to the dialog that should help users make the right selection. A TODO item would be to import an updatable and comprehensive list and use it to dynamically create filters.

Additionally, we now work with a set of programs designed to be used with specific micro:bit programs. We can reliably identify a micro:bit using `deviceInfo`.   Therefore, for now in Dataflow we assume that if we are connected to something other than a micro:bit, it as an arduino.

`handleStream`
Given the stream from the port, and the channels, `handleStream` is responsible for three things:
1. Setting up the reader.
2. Sets up the writer to be used later.
3. Listens to incoming data at the serial port, and while the port is readable, it sends each `value` to either `handleArduinoStreamObj` or `handleMicroBitStreamObj`, depending on the `deviceInfo`.

`handleArduinoStreamObj` or `handleMicroBitStreamObj`
When each of these functions gets the value from the stream, it is a malformed string representation of any number of whole or partial serial messages, chomped off the stream at unpredictable spots that do not respect the original boundaries of the data.  So, it has to reconstitute sensible messages.  To do so, it appends the value to a local buffer.  Then, it scans that local buffer looking for a match of a legitimate value.  The matching expression is closely paired with the devices and the sensors and actuators that we are using with Dataflow.

When it finds a match, it parses out the values it needs, including an indicator of which channel this value should be headed to.  It searches for the corerect channel, and if it finds it, sets the value on the channel.