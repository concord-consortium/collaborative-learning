/** Test fixtures for shared/png-header.ts and its callers. Not used by production code. */

/**
 * The first 24 bytes of a PNG with the given dimensions: signature, IHDR chunk length and tag,
 * width, then height — exactly what a `Range: bytes=0-23` request against a real PNG returns.
 */
export function pngHeaderBytes(widthPx: number, heightPx: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR chunk length, 13
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(bytes.buffer).setUint32(16, widthPx, false);
  new DataView(bytes.buffer).setUint32(20, heightPx, false);
  return bytes;
}
