// Why a transport's device went away without being asked to close: "unplugged" when the browser
// reported the device removed, "lost" for any other failure.
export type DeviceLoss = "unplugged" | "lost";

// A device's write path plus optional inbound callbacks. Both Web Serial and WebUSB
// (micro:bit) implement this so SerialDevice routes writes through one active transport
// and receives inbound data centrally. onData/onDisconnect are wired by the store each time
// the transport becomes active; a transport that manages its own inbound path need not
// use them. A requested disconnect clears onDisconnect before closing, so the close isn't
// recorded as a loss. A transport reused by Reconnect gets it back when it's made active again.
export interface IDeviceTransport {
  write(line: string): void | Promise<void>;   // implementation supplies its own line framing (\n)
  close(): Promise<void>;
  onData?: (chunk: string) => void;
  onDisconnect?: (loss: DeviceLoss) => void;
}

// What happened to a port whose open was given up on: whether closing and forgetting it worked,
// and, once the abandoned open settles later, whether it opened or failed.
export interface IAbandonedOpenInfo {
  close?: "ok" | "failed" | "unsupported";
  forget?: "ok" | "failed" | "unsupported";
  late?: "opened" | "failed";
}

// Starts one part of giving up on an open, and reports how it ended once it settles. Never throws:
// `action` runs on a later tick, so even a synchronous throw is reported as "failed". An undefined
// `action` is reported as "unsupported".
export function tryAbandonedPart(
  part: "close" | "forget", action: (() => Promise<void>) | undefined, report: (info: IAbandonedOpenInfo) => void
) {
  void Promise.resolve()
    .then(() => {
      if (!action) return "unsupported" as const;
      return action().then(() => "ok" as const);
    })
    .catch(() => "failed" as const)
    .then(result => report({ [part]: result }));
}
