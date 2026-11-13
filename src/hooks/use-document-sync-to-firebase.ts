import { useCallback, useEffect, useMemo, useRef } from "react";
import { OnDisconnect } from "firebase-admin/database";
import { useSyncMstNodeToFirebase } from "./use-sync-mst-node-to-firebase";
import { useSyncMstPropToFirebase } from "./use-sync-mst-prop-to-firebase";
import { DEBUG_DOCUMENT, DEBUG_SAVE } from "../lib/debug";
import { Firebase } from "../lib/firebase";
import { ContentStatus, DocumentModelType } from "../models/document/document";
import { isPublishedType, LearningLogDocument, LearningLogPublication, PersonalDocument,
         PersonalPublication, ProblemDocument, ProblemPublication, SupportPublication
        } from "../models/document/document-types";
import { UserModelType } from "../models/stores/user";
import { Firestore } from "src/lib/firestore";
import { getContentSaveSender } from "../models/document/get-content-save-sender";
import { logDocumentEvent } from "../models/document/log-document-event";

// Kept for each document, since its content save sender can outlive the hook and be attached again.
const disconnectHandlersByDocument = new WeakMap<DocumentModelType, OnDisconnect[]>();

function debugLog(...args: any[]) {
  // eslint-disable-next-line no-console
  DEBUG_SAVE && console.log(...args);
}

/*
 * useDocumentSyncToFirebase
 *
 * Prior to 2.1.3 all handlers in both directions were handled in the DBListeners class.
 * From 2.1.3 on the DBListeners class handles firebase => local synchronization, while this
 * custom hook handles local => firebase synchronization. This hook should be used by any
 * component that allows firebase document content or metadata to be edited. This means that
 * we're only actively listening to the document the user is looking at/working on rather than
 * trying to keep track of listeners on all of a user's documents simultaneously.
 */
export function useDocumentSyncToFirebase(
  user: UserModelType,
  firebase: Firebase,
  firestore: Firestore,
  document: DocumentModelType,
  readOnly = false,
  onContentSaved?: (document: DocumentModelType, lastHistoryEntryId: string) => void
) {
  const { key, type, uid, contentStatus } = document;
  const { content: contentPath, metadata, typedMetadata } = firebase.getDocumentPaths(user, document);

  const handlePresenceChange = useMemo(() => (snapshot: any) => {
    // When we come online after being offline, need to note that the onDisconnect events will have been fired.
    // So the next time the document is modified, it needs to be set up again.
    if (snapshot.val() === true) {
      disconnectHandlersByDocument.delete(document);
    }
  }, [document]);

  // TODO: when running in doc-editor this warning was printed constantly
  // Ideally we'd figure out how to separate the syncing from the document stuff so the doc-editor can use
  // documents without also bringing in the syncing.
  // The current hacky approach is to use a window level property to disable the firebase syncing
  const disableFirebaseSync = (window as any).DISABLE_FIREBASE_SYNC;

  // The warning's concern is writing to another user's user-namespaced path, so we allow group documents.
  !disableFirebaseSync && !readOnly && !document.concurrent && (user.id !== uid) &&
    console.warn("useDocumentSyncToFirebase monitoring another user's document?!?");

  const commonSyncEnabled = !disableFirebaseSync && contentStatus === ContentStatus.Valid;

  useEffect(() => {
    // Tree monitoring should be disabled if the document status is error
    if (!readOnly && contentStatus === ContentStatus.Valid) {
      // enable history tracking on this document
      if (document.treeMonitor) {
        document.treeMonitor.enableMonitoring();
      }
      // Set up listener for online status
      if (commonSyncEnabled) {
        firebase.onlineStatusRef.on('value', handlePresenceChange);
      }

      return () => {
        // disable history tracking on this document
        if (document.treeMonitor) {
          document.treeMonitor.disableMonitoring();
        }
        // Remove the online status listener
        if (!readOnly && commonSyncEnabled) {
          firebase.onlineStatusRef.off('value', handlePresenceChange);
        }
      };
    }
  }, [readOnly, contentStatus, document.treeMonitor, firebase, handlePresenceChange, commonSyncEnabled]);

  if (!readOnly && DEBUG_DOCUMENT) {
    // provide the document to the console so developers can inspect its content
    // and history. Only !readOnly documents are made available, this way it is obvious
    // which document currentDocument is pointing to.
    // useDocumentSyncToFirebase is called with readOnly documents too
    (window as any).currentDocument = document;
  }

  /**
   * FIXME: this shouldn't be true anymore.
   * We currently have multiple firestore metadata docs for each real doc.
   * Use this function to update a property in all of them.
   *
   * @param prop
   * @param value
   * @returns
   */
  const updateFirestoreDocumentProp = useCallback((prop: string, value?: string | string[]) => {
    // The context_id is required so the security rules know we aren't trying
    // to get documents we don't have access to.
    // We only update document props like visibility, the title, and tools
    // when the document is being edited. The document can only be edited
    // within its class, so it is safe to use the user.classHash here.
    const firestoreMetadataDocs = firestore.collection("documents")
      .where("key", "==", document.key)
      .where("context_id", "==", user.classHash);

    return firestoreMetadataDocs.get().then((querySnapshot) => {
      return Promise.all(
        querySnapshot.docs.map((doc) => doc.ref.update({ [prop]: value}))
      );
    });
  }, [document, firestore, user]);

  // sync visibility (public/private) for problem documents
  useSyncMstPropToFirebase<typeof document.visibility>({
    firebase, model: document, prop: "visibility", path: typedMetadata,
    enabled: commonSyncEnabled && !readOnly && (type === ProblemDocument),
    options: {
      onSuccess: (data, visibility) => {
        debugLog(`DEBUG: Updated document visibility for ${type} document ${key}:`, visibility);
      },
      onError: (err, visibility) => {
        console.warn(`ERROR: Failed to update document visibility for ${type} document ${key}:`, visibility);
      }
    },
    additionalMutation: updateFirestoreDocumentProp
  });

  // sync visibility (public/private) for personal and learning log documents
  useSyncMstPropToFirebase<typeof document.visibility>({
    firebase, model: document, prop: "visibility", path: metadata,
    enabled: commonSyncEnabled && !readOnly && [PersonalDocument, LearningLogDocument].includes(type),
    options: {
      onSuccess: (data, visibility) => {
        debugLog(`DEBUG: Updated document visibility for ${type} document ${key}:`, visibility);
      },
      onError: (err, visibility) => {
        console.warn(`ERROR: Failed to update document visibility for ${type} document ${key}:`, visibility);
      }
    },
    additionalMutation: updateFirestoreDocumentProp
  });

  // sync title for personal and learning log documents
  useSyncMstPropToFirebase<typeof document.title>({
    firebase, model: document, prop: "title", path: typedMetadata,
    enabled: commonSyncEnabled && !readOnly && [PersonalDocument, LearningLogDocument].includes(type),
    options: {
      onSuccess: (data, title) => {
        debugLog(`DEBUG: Updated document title for ${type} document ${key}:`, title);
      },
      onError: (err, title) => {
        console.warn(`ERROR: Failed to update document title for ${type} document ${key}:`, title);
      }
    },
    additionalMutation: updateFirestoreDocumentProp
  });

  // sync properties for problem, personal, and learning log documents
  useSyncMstNodeToFirebase({
    firebase, model: document.properties, path: `${metadata}/properties`,
    enabled: commonSyncEnabled && !readOnly && [ProblemDocument, PersonalDocument, LearningLogDocument].includes(type),
    options: {
      onSuccess: (data, properties) => {
        debugLog(`DEBUG: Updated document properties for ${type} document ${key}:`, JSON.stringify(properties));
      },
      onError: (err, properties) => {
        console.warn(`ERROR: Failed to update document properties for ${type} document ${key}:`,
                    JSON.stringify(properties));
      }
    }
  });

  // sync properties for published documents
  useSyncMstNodeToFirebase({
    firebase, model: document.properties, path: `${metadata}/properties`,
    enabled: commonSyncEnabled && readOnly &&
      (user.id === uid) && document.supportContentType !== "multiclass" &&
      [ProblemPublication, PersonalPublication, LearningLogPublication, SupportPublication ].includes(type),
    options: {
      onSuccess: (data, properties) => {
        debugLog(`DEBUG: Updated document properties for ${type} document ${key}:`, JSON.stringify(properties));
      },
      onError: (err, properties) => {
        console.warn(`ERROR: Failed to update document properties for ${type} document ${key}:`,
                    JSON.stringify(properties));
      }
    }
  });

  // sync content for editable document types
  const enabled = commonSyncEnabled && !readOnly && !!document.content && !isPublishedType(type);

  // The sender may still be saving after this unmounts, so it calls the newest callback.
  const onContentSavedRef = useRef(onContentSaved);
  onContentSavedRef.current = onContentSaved;

  useEffect(() => {
    if (!enabled) return;
    const sender = getContentSaveSender(document, {
      rtdbEnvelopeRef: firebase.ref(contentPath),
      updateTools: tools => updateFirestoreDocumentProp("tools", tools),
      beforeWrite: () => {
        if (!disconnectHandlersByDocument.has(document)) {
          disconnectHandlersByDocument.set(document, firebase.setLastEditedOnDisconnect(user, key, uid));
        }
      },
      onContentSaved: (savedDocument, lastHistoryEntryId) => {
        debugLog(`DEBUG: Updated document content for ${type} document ${key}:`, savedDocument.changeCount);
        onContentSavedRef.current?.(savedDocument, lastHistoryEntryId);
      },
      logEvent: (event, params) => logDocumentEvent(event, { document, ...params }),
      // Once the last save is sent, an onDisconnect that was set is removed and the updated timestamp
      // is set to now. This can request the session-end evaluation, so it waits for that save.
      onDrained: () => {
        const disconnectHandlers = disconnectHandlersByDocument.get(document);
        if (disconnectHandlers) {
          disconnectHandlersByDocument.delete(document);
          firebase.setLastEditedNow(user, key, uid, disconnectHandlers);
        }
      }
    });
    return () => sender.detach();
  }, [enabled, document, firebase, contentPath, user, key, uid, type, updateFirestoreDocumentProp]);

  useEffect(() => {
    DEBUG_SAVE && !readOnly &&
      debugLog("DEBUG: monitoring", type, "document", key);
    return () => {
      DEBUG_SAVE && !readOnly &&
        debugLog(`DEBUG: unmonitoring ${type} document ${key}`);
    };
  }, [document, firebase, key, readOnly, type, user]);
}
