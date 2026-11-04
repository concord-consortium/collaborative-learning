import { applyPatch, Operation } from "fast-json-patch";

// Rebuilds a document from its stored history entries with a plain JSON patch library, as a
// service that knows nothing about CLUE would. Nothing here imports CLUE.

export interface IStoredRecord {
  patches: Operation[];
  inversePatches: Operation[];
}
export interface IStoredEntry {
  isLoadEntry?: boolean;
  records: IStoredRecord[];
}

const clone = (value: any) => JSON.parse(JSON.stringify(value));

function undoEntry(doc: any, entry: IStoredEntry) {
  [...entry.records].reverse().forEach(record => {
    applyPatch(doc, clone([...record.inversePatches].reverse()), false, true);
  });
}

function redoEntry(doc: any, entry: IStoredEntry) {
  entry.records.forEach(record => {
    applyPatch(doc, clone(record.patches), false, true);
  });
}

/**
 * Undoes every entry from `endDocument` back to the start, then redoes them all. The load entry
 * is applied like any other entry. Returns the document at each position, where
 * `positions[i]` comes before entry `i`, and the document rebuilt at the end.
 */
export function rebuildBackAndForth(endDocument: any, entries: IStoredEntry[]) {
  const doc = clone(endDocument);
  const positions: any[] = [clone(doc)];
  for (let i = entries.length - 1; i >= 0; i--) {
    undoEntry(doc, entries[i]);
    positions.unshift(clone(doc));
  }
  entries.forEach(entry => redoEntry(doc, entry));
  return { positions, end: doc };
}
