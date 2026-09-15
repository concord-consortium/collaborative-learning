// The size of a string as it travels, for the byte-denominated caps on both sides of the tutor
// wire: ForeverLearning measures its context cap in bytes, and Firestore measures its document
// limit in bytes. A JavaScript string's length is UTF-16 code units, so measuring that instead
// admits exactly the payloads those caps exist to stop — a four-byte emoji is two units of length.
export function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}
