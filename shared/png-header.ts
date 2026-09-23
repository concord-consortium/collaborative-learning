/**
 * Reads a PNG's width and height straight from its header, without an image library.
 *
 * The signature and IHDR's width/height fields sit in the first 24 bytes of any PNG — exactly
 * what a `Range: bytes=0-23` request returns.
 */

const kPngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function readPngDimensions(bytes: Uint8Array): {widthPx: number; heightPx: number} {
  if (bytes.length < 24) {
    throw new Error(`PNG header check got only ${bytes.length} byte(s), need at least 24`);
  }
  for (let i = 0; i < kPngSignature.length; i++) {
    if (bytes[i] !== kPngSignature[i]) {
      throw new Error(`does not start with the PNG signature (got ${Array.from(bytes.slice(0, 8))})`);
    }
  }
  const tag = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (tag !== "IHDR") {
    throw new Error(`first chunk is "${tag}", not IHDR`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const widthPx = view.getUint32(16, false);
  const heightPx = view.getUint32(20, false);
  return {widthPx, heightPx};
}
