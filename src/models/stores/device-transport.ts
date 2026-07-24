// A device's write path. Both Web Serial and WebUSB (micro:bit) implement this so
// SerialDevice.writeLine routes through one active transport instead of a
// per-transport branch. Read/parse and connect/flash intentionally stay out of this
// interface — see the design spec §3.1.
export interface IDeviceTransport {
  write(line: string): void;   // implementation supplies its own line framing (\n)
  close(): Promise<void>;
}
