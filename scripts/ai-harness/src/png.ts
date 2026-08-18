/**
 * Reading a PNG's size straight out of its header.
 *
 * Every image the harness records carries its width and height, because the image-token cost model
 * is computed from them and freshness checks compare them against what is on disk. Rather than add a
 * dependency to a package that pins exact versions and runs a three-way lockstep test, the header is
 * read directly: the eight-byte signature, then the IHDR chunk, whose width and height sit at fixed
 * offsets. Doing it this way also answers "is this actually a PNG?" at the same time, which matters
 * because a `.png` suffix on a downloaded file is not evidence of PNG bytes.
 */

/** The eight bytes every PNG file starts with. */
const kSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** IHDR is always the first chunk and always 13 bytes of data. */
const kIhdrLength = 13;

export class NotAPngError extends Error {
  constructor(public readonly source: string, detail: string) {
    super(`${source} is not a usable PNG: ${detail}`);
    this.name = "NotAPngError";
  }
}

/**
 * Walks the chunk stream and insists it ends with IEND.
 *
 * The signature and IHDR alone are not evidence of a usable image: 29 bytes carrying both, and
 * nothing else, would otherwise be accepted, stored, and eventually sent to the model. Walking the
 * declared chunk lengths catches a truncated download for the cost of a few reads — the chunk CRCs
 * are deliberately not verified, since the concern here is truncation and wrong content rather than
 * bit rot, and the file's sha256 is recorded separately.
 */
function walkChunks(bytes: Buffer, source: string): void {
  let offset = 8;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("latin1");
    // length + type + data + crc
    offset += 12 + length;
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd || offset > bytes.length) {
    throw new NotAPngError(source,
      `its chunk stream does not end with a complete IEND chunk within ${bytes.length} byte(s), ` +
      "so the file is truncated or is not a whole PNG");
  }
}

export interface PngInfo {
  widthPx: number;
  heightPx: number;
}

/**
 * Reads width and height from `bytes`, throwing `NotAPngError` when it is not a PNG.
 *
 * `source` only ever appears in the error message — a file path, a URL, or a description of where
 * the bytes came from.
 */
export function readPngInfo(bytes: Buffer, source: string): PngInfo {
  if (bytes.length < 8 + 4 + 4 + kIhdrLength) {
    throw new NotAPngError(source, `it is only ${bytes.length} byte(s) long`);
  }
  if (!bytes.subarray(0, 8).equals(kSignature)) {
    throw new NotAPngError(source, `its first eight bytes are ${bytes.subarray(0, 8).toString("hex")}, ` +
      `not the PNG signature ${kSignature.toString("hex")}`);
  }
  const declaredLength = bytes.readUInt32BE(8);
  const chunkType = bytes.subarray(12, 16).toString("latin1");
  if (chunkType !== "IHDR") {
    throw new NotAPngError(source, `its first chunk is "${chunkType}", not IHDR`);
  }
  if (declaredLength !== kIhdrLength) {
    throw new NotAPngError(source, `its IHDR chunk declares ${declaredLength} bytes, not ${kIhdrLength}`);
  }
  walkChunks(bytes, source);
  const widthPx = bytes.readUInt32BE(16);
  const heightPx = bytes.readUInt32BE(20);
  // A zero dimension is legal to write down and impossible to render, and it would make the image
  // cost model divide a screenshot into no tiles at all.
  if (widthPx === 0 || heightPx === 0) {
    throw new NotAPngError(source, `its IHDR reports a ${widthPx}×${heightPx} image`);
  }
  return { widthPx, heightPx };
}
