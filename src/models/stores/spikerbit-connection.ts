// Only file in the app that statically imports @microbit/microbit-connection.
// The library is ESM and not in the jest transformIgnorePatterns allowlist, so
// no other module (and no test) may import it directly; consumers should load
// this file with a dynamic import() from a click handler instead.
import { createUSBConnection } from "@microbit/microbit-connection/usb";
import { createUniversalHexFlashDataSource } from "@microbit/microbit-connection/universal-hex";
import { IMicrobitUsbConnection } from "./spikerbit-device";

export function createSpikerbitConnection(): IMicrobitUsbConnection {
  return createUSBConnection() as unknown as IMicrobitUsbConnection;
}

export function makeSpikerbitFlashDataSource(hex: string) {
  return createUniversalHexFlashDataSource(hex);
}
