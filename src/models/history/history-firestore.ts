import firebase from "firebase/app";
import { DEBUG_HISTORY } from "../../lib/debug";
import { Firestore } from "../../lib/firestore";
import { HistoryEntrySnapshot } from "./history";

export type LastHistoryEntry = undefined | { index: number, id: string };

export async function getLastHistoryEntry(firestore: Firestore, documentPath: string): Promise<LastHistoryEntry> {
  const lastEntryQuery = await firestore.collection(`${documentPath}/history`)
    .limit(1)
    .orderBy("index", "desc")
    .get();

  if (lastEntryQuery.empty) {
    return undefined;
  }

  const lastEntry = lastEntryQuery.docs[0];
  const index = lastEntry.get("index");
  if (typeof index !== "number") {
    // This is an invalid entry.
    // Previously the index was a timestamp instead of a number, however
    // the Firestore collection of entries was changed from
    // `historyEntries` to `history`, so we shouldn't pick
    // up any legacy entries.
    throw new Error(`lastEntryIndex is not a number: ${index}`);
  }

  return { index, id: lastEntry.id };
}

type LoadedHistoryHandler = (entries: HistoryEntrySnapshot[], error?: firebase.firestore.FirestoreError) => void;


/**
 * Load the history entries from Firestore, and monitor changes to this history.
 *
 * @param firestore CLUE Firestore instance
 * @param historyPath location of history entries in Firestore
 * @param handleLoadedHistory callback receiving the history or error, the
 * callback will be called whenever the history changes in Firestore.
 * @returns a disposer function to cleanup the Firestore query
 */
export function loadHistory(firestore: Firestore, historyPath: string,
  handleLoadedHistory: LoadedHistoryHandler) {
  const query = firestore.collection(historyPath)
    .orderBy("index");

  // FIXME-HISTORY: this approach does not handle paging,
  // and I'd suspect we'll have a lot of changes so we'll need to handle that.
  // Because individual history entry documents don't change and the indexes are
  // always increasing, so we can probably come up with an efficient way to
  // return the entries in pages and then send just the new entries as they
  // are added.
  return query.onSnapshot(
    querySnapshot => {
      if (DEBUG_HISTORY) {
        // eslint-disable-next-line no-console
        console.log("Loaded History:", querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
      const history = querySnapshot.docs.map(doc => {
        const { entry } = doc.data();
        return JSON.parse(entry) as HistoryEntrySnapshot;
      });
      handleLoadedHistory(history);
    },
    error => {
      handleLoadedHistory([], error);
    }
  );

}

// TODO: it would probably be useful to split out more of the history
// mirroring code from the TreeManager. However even if we do that it is useful
// to keep these two functions in their own module. That way the tests
// can mock these functions and test the history mirroring logic without
// needing a Firestore simulator.
//
// We are going to have to add more stateful monitoring of the entry loading
// in order to support corrupted history that is missing some entries.
// So that might be a good time to split the history mirroring out of
// the TreeMonitor
