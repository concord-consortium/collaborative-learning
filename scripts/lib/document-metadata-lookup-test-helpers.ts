import type { IMetadataDatabase } from "./document-metadata-lookup";

/**
 * Minimal RTDB stand-in for tests. `nodes` maps a full path to the value stored there; a path absent
 * from the map reads back as a non-existent node. `throwOn` makes a path reject, so a transport
 * failure can be told apart from a missing node — the two mean different things to every caller.
 * `reads` records every path read, so a test can assert that a document was never looked up at all.
 */
export function makeRtdb(nodes: Record<string, any>, throwOn: string[] = []) {
  const reads: string[] = [];
  const db: IMetadataDatabase & { reads: string[] } = {
    reads,
    ref: (path: string) => ({
      once: (_eventType: "value") => {
        reads.push(path);
        if (throwOn.includes(path)) return Promise.reject(new Error("rtdb unavailable"));
        const value = nodes[path];
        return Promise.resolve({ exists: () => value !== undefined, val: () => value });
      }
    })
  };
  return db;
}
