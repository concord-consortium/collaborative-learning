// Thin typed wrapper around @microbit/microbit-connection. Consolidating the library's
// subpath imports and the `as unknown as IMicrobitUsbConnection` cast here keeps the
// untyped surface in one place.
import { createUSBConnection } from "@microbit/microbit-connection/usb";
import { createUniversalHexFlashDataSource } from "@microbit/microbit-connection/universal-hex";
import { IMicrobitUsbConnection } from "./spikerbit-device";

export function createSpikerbitConnection(): IMicrobitUsbConnection {
  return createUSBConnection() as unknown as IMicrobitUsbConnection;
}

export function makeSpikerbitFlashDataSource(hex: string) {
  return createUniversalHexFlashDataSource(hex);
}
