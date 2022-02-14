import { useEffect } from "react";
import { useSyncMstNodeToFirebase } from "./use-sync-mst-node-to-firebase";
import { useSyncMstPropToFirebase } from "./use-sync-mst-prop-to-firebase";
import { DEBUG_SAVE } from "../lib/debug";
import { Firebase } from "../lib/firebase";
import { DocumentModelType } from "../models/document/document";
import {
  isPublishedType, LearningLogDocument, PersonalDocument, ProblemDocument
} from "../models/document/document-types";
import { UserModelType } from "../models/stores/user";

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
                  user: UserModelType, firebase: Firebase, document: DocumentModelType, readOnly = false) {
  const { key, type, uid } = document;
  const { content: contentPath, typedMetadata } = firebase.getUserDocumentPaths(user, type, key, uid);
  (user.id !== uid) && console.warn("useDocumentSyncToFirebase monitoring another user's document?!?");

  // sync visibility (public/private) for problem documents
  useSyncMstPropToFirebase<typeof document.visibility>({
    firebase, model: document, prop: "visibility", path: typedMetadata,
    enabled: !readOnly && (type === ProblemDocument),
    options: {
      onSuccess: (data, visibility) => {
        debugLog(`DEBUG: Updated document visibility for ${type} document ${key}:`, visibility);
      },
      onError: (err, visibility) => {
        console.warn(`ERROR: Failed to update document visibility for ${type} document ${key}:`, visibility);
      }
    }
  });

  // sync title for personal and learning log documents
  useSyncMstPropToFirebase<typeof document.title>({
    firebase, model: document, prop: "title", path: typedMetadata,
    enabled: !readOnly && [PersonalDocument, LearningLogDocument].includes(type),
    options: {
      onSuccess: (data, title) => {
        debugLog(`DEBUG: Updated document title for ${type} document ${key}:`, title);
      },
      onError: (err, title) => {
        console.warn(`ERROR: Failed to update document title for ${type} document ${key}:`, title);
      }
    }
  });

  // sync properties for personal and learning log documents
  useSyncMstNodeToFirebase({
    firebase, model: document.properties, path: typedMetadata,
    enabled: !readOnly && [PersonalDocument, LearningLogDocument].includes(type),
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
  useSyncMstNodeToFirebase({
    firebase, model: document.content, path: contentPath,
    enabled: !readOnly && document.content && !isPublishedType(type),
    transform: snapshot => ({ changeCount: document.incChangeCount(), content: JSON.stringify(snapshot) }),
    options: {
      onSuccess: (data, snapshot) => {
        debugLog(`DEBUG: Updated document content for ${type} document ${key}:`, document.changeCount);
      },
      onError: (err, properties) => {
        console.warn(`ERROR: Failed to update document content for ${type} document ${key}:`, document.changeCount);
      }
    }
  });

  useEffect(() => {
    DEBUG_SAVE && !readOnly &&
      debugLog("DEBUG: monitoring", type, "document", key);
    return () => {
      DEBUG_SAVE && !readOnly &&
        debugLog(`DEBUG: unmonitoring ${type} document ${key}`);
    };
  }, [document, firebase, key, readOnly, type, user]);
}
