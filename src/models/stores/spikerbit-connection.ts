// Thin typed wrapper around @microbit/microbit-connection. Consolidating the library's
// subpath imports here keeps its surface in one place.
import { createUSBConnection } from "@microbit/microbit-connection/usb";
import { createUniversalHexFlashDataSource } from "@microbit/microbit-connection/universal-hex";
import { IMicrobitUsbConnection } from "./spikerbit-device";

/**
 * Creates a new Spikerbit USB connection, typed as the minimal interface we use.
 */
export function createSpikerbitConnection(): IMicrobitUsbConnection {
  return createUSBConnection();
}

export function makeSpikerbitFlashDataSource(hex: string) {
  return createUniversalHexFlashDataSource(hex);
}
