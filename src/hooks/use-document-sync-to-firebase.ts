import { useEffect, useMemo } from "react";
import { throttle as _throttle } from "lodash";
import { onSnapshot, SnapshotOut } from "mobx-state-tree";
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
import { useMutation, UseMutationOptions } from "react-query";
import { ITileMapEntry } from "functions/src/shared";
import { DocumentContentSnapshotType } from "src/models/document/document-content";
import { IArrowAnnotation } from "src/models/annotations/arrow-annotation";

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
  readOnly = false
) {
  const { key, type, uid, contentStatus } = document;
  const { content: contentPath, metadata, typedMetadata } = firebase.getUserDocumentPaths(user, type, key, uid);

  // TODO: when running in doc-editor this warning was printed constantly
  // Ideally we'd figure out how to separate the syncing from the document stuff so the doc-editor can use
  // documents without also bringing in the syncing.
  // The current hacky approach is to use a window level property to disable the firebase syncing
  const disableFirebaseSync = (window as any).DISABLE_FIREBASE_SYNC;

  !disableFirebaseSync && !readOnly && (user.id !== uid) &&
    console.warn("useDocumentSyncToFirebase monitoring another user's document?!?");

  useEffect(() => {
    // To handle errors this should be disabled if the document status is error
    if (!readOnly && contentStatus === ContentStatus.Valid) {
      // enable history tracking on this document
      if (document.treeMonitor) {
        document.treeMonitor.enabled = true;
      }
      return () => {
        // disable history tracking on this document
        if (document.treeMonitor) {
          document.treeMonitor.enabled = false;
        }
      };
    }
  }, [readOnly, contentStatus, document.treeMonitor]);

  if (!readOnly && DEBUG_DOCUMENT) {
    // provide the document to the console so developers can inspect its content
    // and history. Only !readOnly documents are made available, this way it is obvious
    // which document currentDocument is pointing to.
    // useDocumentSyncToFirebase is called with readOnly documents too
    (window as any).currentDocument = document;
  }

  const commonSyncEnabled = !disableFirebaseSync && contentStatus === ContentStatus.Valid;

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
    }
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
    }
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
    }
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
  const options: Omit<UseMutationOptions<unknown, unknown, SnapshotOut<DocumentContentSnapshotType>>, 'mutationFn'> = {
    // default is to retry with linear back-off to a maximum
    retry: true,
    retryDelay: (attempt) => Math.min(attempt * 5, 30),
    // but clients may override the defaults
    onSuccess: (data: any, snapshot: DocumentContentSnapshotType) => {
      debugLog(`DEBUG: Updated document content for ${type} document ${key}:`, document.changeCount);
    },
    onError: (err: any, properties: DocumentContentSnapshotType) => {
      console.warn(`ERROR: Failed to update document content for ${type} document ${key}:`, document.changeCount);
    }
  };
  const transform = (snapshot: DocumentContentSnapshotType) =>
    ({ changeCount: document.incChangeCount(), content: JSON.stringify(snapshot) });

  const mutation = useMutation((snapshot: DocumentContentSnapshotType) => {
    const tileMap = snapshot.tileMap || {};

    const tools: string[] = [];

    Object.keys(tileMap).forEach((tileKey) => {
      const tileInfo = tileMap[tileKey] as ITileMapEntry;
      const tileType = tileInfo.content.type;
      if (!tools.includes(tileType)) {
        tools.push(tileType);
      }
    });

    // The annotations property does exist on the snapshot but MobX doesn't recognize it
    // as a property because of the way we are constructing the DocumentContentModel
    // on top of multiple other models. This typing is a workaround so TS doesn't complain.
    const annotations =
      (snapshot as {annotations: Record<string, IArrowAnnotation>}).annotations || {};

    Object.keys(annotations).forEach((annotationKey: string) => {
      const annotation = annotations[annotationKey];
      // for now we only want Sparrow annotations
      // we might want to change this if we want to count other types in the future
      if (annotation.type === "arrowAnnotation" && !tools.includes("Sparrow")) {
        tools.push("Sparrow");
      }
    });

    const promises = [];

    // update tiletypes for metadata document in firestore
    const query = firestore.collection("documents").where("key", "==", document.key);
    promises.push(query.get().then((querySnapshot) => {
      return Promise.all(
        querySnapshot.docs.map((doc) => {
          const docRef = doc.ref;
          return docRef.update({
            tools,
          });
        })
      );
    }));

    promises.push(firebase.ref(contentPath).update(transform?.(snapshot) ?? snapshot));
    return Promise.all(promises);
  }, options);

  const throttledMutate = useMemo(() => _throttle(mutation.mutate, 1000), [mutation.mutate]);

  useEffect(() => {
    const cleanup = enabled
            ? onSnapshot<DocumentContentSnapshotType>(document.content!, snapshot => {
                // reset (e.g. stop retrying and restart) when value changes
                mutation.isError && mutation.reset();
                throttledMutate(snapshot);
              })
            : undefined;
    return () => {
      cleanup?.();
    };
  }, [enabled, document.content, mutation, throttledMutate]);

  useEffect(() => {
    DEBUG_SAVE && !readOnly &&
      debugLog("DEBUG: monitoring", type, "document", key);
    return () => {
      DEBUG_SAVE && !readOnly &&
        debugLog(`DEBUG: unmonitoring ${type} document ${key}`);
    };
  }, [document, firebase, key, readOnly, type, user]);
}
