// A device's write path plus optional inbound callbacks. Both Web Serial and WebUSB
// (micro:bit) implement this so SerialDevice routes writes through one active transport
// and receives inbound data centrally. onData/onDisconnect are wired by the store when
// the transport becomes active; a transport that manages its own inbound path need not
// use them.
export interface IDeviceTransport {
  write(line: string): void;   // implementation supplies its own line framing (\n)
  close(): Promise<void>;
  onData?: (chunk: string) => void;
  onDisconnect?: () => void;
}
