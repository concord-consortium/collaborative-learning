import { throttle } from "lodash";
import { reaction } from "mobx";
import { onSnapshot } from "mobx-state-tree";
import { useEffect, useMemo } from "react";
import { Firebase } from "../lib/firebase";
import { DocumentModelType } from "../models/document/document";
import {
  isPublishedType, LearningLogDocument, PersonalDocument, ProblemDocument
} from "../models/document/document-types";
import { UserModelType } from "../models/stores/user";

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

  const throttledContentUpdate = useMemo(() => throttle((changeCount: number, content: string) => {
    firebase.ref(contentPath).update({ changeCount, content })
      .then(() => {
        // console.log("Successful save", "document:", key, "changeCount:", changeCount);
      })
      .catch(() => {
        user.setIsFirebaseConnected(false);
        console.warn("Failed save!", "document:", key, "changeCount:", changeCount);
      });
  }, 2000, { trailing: true }), [contentPath, firebase, key, user]);

  useEffect(() => {
    console.log(`useDocumentSyncToFirebase installing listeners for ${type} document ${key} (${readOnly})`);
    const visibilityListenerDisposer = !readOnly && (type === ProblemDocument)
            ? reaction(() => document.visibility, visibility => {
                console.log(`Updating document visibility for ${type} document ${key}:`, visibility);
                firebase.ref(typedMetadata).update({ visibility });
              })
            : undefined;
    const titleListenerDisposer = !readOnly && [PersonalDocument, LearningLogDocument].includes(type)
            ? reaction(() => document.title, title => {
                console.log(`Updating document title for ${type} document ${key}:`, title);
                firebase.ref(typedMetadata).update({ title });
              })
            : undefined;
    const propsListenerDisposer = !readOnly && [PersonalDocument, LearningLogDocument].includes(type)
            ? onSnapshot(document.properties, properties => {
                console.log(`Updating document properties for ${type} document ${key}:`, JSON.stringify(properties));
                firebase.ref(typedMetadata).update({ properties });
              })
            : undefined;
    const contentListenerDisposer = !readOnly && document.content && !isPublishedType(type)
            ? onSnapshot(document.content, contentSnapshot => {
                const changeCount = document.incChangeCount();
                console.log(`Updating document content for ${type} document ${key}:`, changeCount);
                contentSnapshot && throttledContentUpdate(changeCount, JSON.stringify(contentSnapshot));
              })
            : undefined;
    return () => {
      console.log(`useDocumentSyncToFirebase removing listeners for ${type} document ${key} (${readOnly})`);
      visibilityListenerDisposer?.();
      titleListenerDisposer?.();
      propsListenerDisposer?.();
      contentListenerDisposer?.();
    };
  }, [document, firebase, key, readOnly, throttledContentUpdate, type, typedMetadata, user]);
}
