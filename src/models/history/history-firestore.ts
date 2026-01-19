import { getSnapshot, Instance } from "mobx-state-tree";
import firebase from "firebase/app";
import { getSimpleDocumentPath, IDocumentMetadata } from "../../../shared/shared";
import { DEBUG_HISTORY } from "../../lib/debug";
import { Firestore } from "../../lib/firestore";
import { UserContextProvider } from "../stores/user-context-provider";
import { HistoryEntry, HistoryEntrySnapshot } from "./history";
import { TreeAPI } from "./tree-api";
import { CDocumentType } from "./tree-manager";

export type LastHistoryEntry = undefined | { index: number, id: string};

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
        console.log("Loaded History:", querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
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

interface IFirestoreHistoryInfo {
  documentPath: string;
  lastEntryIndex: number;
  lastEntryId: string | null;
}

interface IMainDocument extends TreeAPI {
  key: string;
  uid: string;
  metadata: IDocumentMetadata;
}

/**
 * Manages saving history entries to Firestore for a document. In the future this class may
 * also manage loading history entries from Firestore.
 *
 * In the future there might be a subclass which handles documents being edited by multiple
 * users at the same time.
 */
export class FirestoreHistoryManager {
  firestore: Firestore;
  userContextProvider: UserContextProvider;
  mainDocument: IMainDocument;

  constructor(firestore: Firestore, userContextProvider: UserContextProvider,
    mainDocument: IMainDocument) {
    this.firestore = firestore;
    this.userContextProvider = userContextProvider;
    this.mainDocument = mainDocument;

    this.onHistoryEntryCompleted = this.onHistoryEntryCompleted.bind(this);
  }

  async prepareFirestoreHistoryInfo(): Promise<IFirestoreHistoryInfo> {
    const { userContextProvider, mainDocument, firestore } = this;
    // TODO: Wait for userContext to be valid.
    // The userContext initially starts out with a user id of 0 and doesn't have a portal and other
    // properties defined. After the user is authenticated the userContext will have valid fields.
    // The invalid userContext will cause an error below. So we should use something like a MobX
    // `await when(() => userContext?.uid)`. So far we haven't seen a case where
    // prepareFirestoreHistoryInfo is called before the userContext is ready.
    const userContext = userContextProvider?.userContext;

    if (!userContextProvider || !mainDocument || !firestore || !userContext?.uid) {
      console.error("cannot record history entry because environment is not valid",
        { userContext, mainDocument, firestore });
      throw new Error("cannot record history entry because environment is not valid");
    }

    // Get the path to the Firestore metadata document that will be the parent of the history entries
    const documentPath = getSimpleDocumentPath(mainDocument.key);
    const documentRef = firestore.doc(documentPath);

    // The creation of the Firestore metadata document should have already been started by
    // DB#createDocument. However createDocument does not wait for the metadata to actually exist.
    // So here, we wait up to 5 seconds for this metadata document to exist.
    const timeoutForMetadataMs = 5000;
    await new Promise<void>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined = undefined;
      const disposer = documentRef.onSnapshot(doc => {
        if (doc.exists) {
          resolve();
          if (timeoutId) {
            disposer();
            clearTimeout(timeoutId);
          }
        }
      });
      timeoutId = setTimeout(() => {
        // If there isn't a firestore metadata document in 5 seconds then give up
        disposer();
        console.warn("Could not find metadata document to attach history to", documentPath);
        // If there is an error here the history will not be saved for the duration
        // of this CLUE session.
        // This happens because the rejection will bubble up to onHistoryEntryCompleted.
        // That does not handle errors from this promise. It will throw an exception.
        // The error should be printed as an unhandled promise error.
        // This rejected promise should now be stored in firestoreHistoryInfoPromise
        // The next time a history entry is "completed" this rejected promise will be awaited
        // again which should throw the same exception again.
        // TODO: consider updating this to create the metadata document itself by
        // calling createFirestoreMetadataDocument.
        // TODO: if this kind of error results in lots of "unhandled promise errors" shown
        // in the console, explicity disable firestore saving after the first error.
        reject(`Could not find metadata document to attach history to ${documentPath}`);
      }, timeoutForMetadataMs);
    });

    const lastHistoryEntry = await getLastHistoryEntry(firestore, documentPath);

    return {
      documentPath,
      // We start with -1 so if there is no last entry the next entry will get an index of 0
      // 0 is a valid index so ?? must be used instead of ||
      lastEntryIndex: lastHistoryEntry?.index ?? -1,
      // We use null here so this is a valid Firestore property value
      lastEntryId: lastHistoryEntry?.id || null
    };
  }

  firestoreHistoryInfoPromise: Promise<IFirestoreHistoryInfo> | undefined;

  async onHistoryEntryCompleted(
    historyContainer: CDocumentType,
    entry: Instance<typeof HistoryEntry>,
    newLocalIndex: number
  ) {
    // The parent Firestore metadata document might not be ready yet so we need to wait for that.
    // We also need to wait for the last history entry to be known so we know what index to assign
    if (!this.firestoreHistoryInfoPromise) {
      this.firestoreHistoryInfoPromise = this.prepareFirestoreHistoryInfo();
    }
    const { documentPath, lastEntryIndex, lastEntryId } = await this.firestoreHistoryInfoPromise;
    const { firestore } = this;

    // add a new document for this history entry
    const historyEntryPath = firestore.getFullPath(`${documentPath}/history`);

    const previousEntryLocalIndex = newLocalIndex - 1;
    const previousEntry = previousEntryLocalIndex >= 0 && historyContainer.history.at(previousEntryLocalIndex);
    const previousEntryId = previousEntry ? previousEntry.id : lastEntryId;

    const docRef = firestore.documentRef(historyEntryPath, entry.id);
    const snapshot = getSnapshot(entry);

    // If there was no last entry in Firestore, prepareFirestoreHistoryInfo sets
    // lastEntryIndex to -1
    const index = lastEntryIndex + 1 + newLocalIndex;
    docRef.set({
      index,
      created: firestore.timestamp(),
      previousEntryId,
      entry: JSON.stringify(snapshot)
    });
  }
}
